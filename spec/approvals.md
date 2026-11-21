# Approvals by link

A way to get sign-off on variants from people outside the app [D-095]. The user makes a password-protected link per campaign; a visitor opens it, enters the password, sees the campaign's variants and signs off on one with an email address; the sign-offs show in the app. Opt-in: nothing happens until the user sets up a service and makes a link.

Every part of this file is **Not built**. Slices: `spec/phases/approvals.md` (AP-1 to AP-13). The service itself (routes, database, visitor pages, sessions, passwords, pictures on its side, deploying) is in `spec/approvals-service.md`. Assumptions A-82 to A-100 are at the end of this file.

## How it fits together

```
Desktop app (main process)                       Cloudflare Worker + D1            Visitor's browser
  Settings: service address, key  ── HTTPS + key ──>  /api/v1/...                        
  "Update gallery":                                                                  
    render each variant (render service)                                              
    upload PNG to the user's S3 bucket                                                 
    sign a read address (7 days)  ── gallery + addresses ──>  stores rows              
  "Refresh" / timer  <── sign-offs ──  /api/v1/links/...                               
                                       /l/{slug}  <── password, sign-off forms ──  visitor
                                       fetches the picture from S3 ──> passes it on to visitor
```

- The app talks only to the service, never to its database [D-095, A-82].
- The pictures live in the user's S3 bucket ("that's one layer covered"); the visitor never sees the bucket address.
- A link belongs to one campaign. The service finds it by the project ID and campaign ID (A-84).
- Nothing in this feature runs, sends or publishes until the user presses a button. The background refresh only reads.

## Settings

### The service address

- `settings.json` gains `approvals: { baseUrl: string | null }`, default `{ baseUrl: null }` (`src/shared/schemas/settings.ts`, `src/main/settings/defaults.ts`).
- **One writer:** `approvals.setService`. `settings.update` refuses the key (its strict schema does not list it). Security class.
- **The rule** (`parseApprovalsAddress(text, { allowLocalHttp })`, `src/shared/approvals/address.ts`, pure): trimmed; parsed as a URL; scheme `https:`; a host name with at least one dot that is not an IP address (v4 or v6) and not `localhost`; no user name or password; nothing after the host and port but at most one `/`. Stored as the origin (`https://host` or `https://host:port`). Anything else is refused with "Enter an address that starts with https:// and has a host name, with nothing after it."
- **Local test exception.** With `allowLocalHttp: true`, exactly `http://127.0.0.1:{port}` is also accepted. The main process passes `deps.devTools` (true only in an unpackaged app started with `ADMAN_DEV_TOOLS=1`). A packaged app never accepts plain `http`.
- **On load** (`settings-store.ts`): an address that fails the rule (with `allowLocalHttp: false`, since the store does not know about dev tools) is read as null; the refused text is kept nowhere; the next save writes null. The same rule as `comfyui.baseUrl` (`spec/infra-and-settings.md`, "Loading the file"). A local test address is therefore set again by the test at each start.
- `__proto__` inside `approvals` adds nothing (the existing `merge` rule).

### The key

- Secret name `approvals.apiKey`, added to `SECRET_NAMES` (`src/shared/schemas/secrets.ts`), stored in `secrets.bin` like every key. Saved with the existing `secret.set` (agents denied).
- It leaves the main process only inside the `Authorization` header of a request to the saved address. Never in a project file, a log line, an error, an event, an MCP reply, or a query reply. `app.getState` lists it by its last four characters, like every other key (A-98).

### Cloud storage: the S3 part

The gallery needs a bucket. This feature builds the **S3 part** of Settings' "Cloud storage" ahead of Phase 9 (A-95). Built (AP-10a); "Test connection" is AP-10b. Both are written in `spec/storage-and-publish.md`, "Storage settings screen". Phase 9 adds Dropbox to the same section.

## The service client

`src/main/approvals/client.ts`, `request.ts`, `failure.ts`. Security class, full review.

- **One function per API route** of `spec/approvals-service.md`, each taking the origin and the key from its caller (read from settings and secrets at the start of each command, never kept between commands).
- **How it sends.** Node's `https` (`http` only for the local test exception), with its own `Agent` (`keepAlive: false`, `rejectUnauthorized: true`, no proxy from the environment), the same pattern as the ComfyUI client. Host and port come only from the saved origin; the path only from the route table with IDs that passed their rule.
- **No redirects.** A `3xx` is a failure of kind `other`. Node's `https` follows none by itself; the client adds none.
- **Limits** (nuisance numbers): 20 s for the whole request; reply body at most 4 MiB, read with a cap.
- **Every reply is checked** with the contract's schema (`src/shared/approvals/contract.ts`). A reply that fails is kind `other`. Text from the reply is never put into an error message, a log line or the window, except the fields the contract allows (`slug`, emails, IDs, times), and those only through the local tables.
- **Failures** become `PROVIDER_ERROR` with `details = { service: 'approvals', kind }`:

| Answer | `kind` | Message |
|--------|--------|---------|
| `401 bad_key` | `bad_key` | "The approvals service did not accept the key. Check the key in Settings." |
| `503 not_set_up` | `not_set_up` | "The approvals service has no key of its own yet. Finish its setup steps first." |
| No connection, name not found, TLS failure | `offline` | "The approvals service could not be reached. Check the address and your connection." |
| Time limit | `timeout` | "The approvals service took too long to answer. Try again." |
| Health with another contract number | `other` | "The approvals service is a different version from this app." |
| Anything else (bad shape, `3xx`, `5xx`, `400`) | `other` | "The approvals service gave an answer the app does not understand." |

- `404 not_found` on a link route is not a failure: the caller handles it ("The link is gone", below).
- **Logs.** One line per failure: `name: 'approvals.request'`, the route name (`health`, `createLink`, ...), the `kind`, the HTTP status. Never the address, the key, a body, a slug, an email or a picture address.

## Local tables

Migration `0004_approvals` (made by `npm run db:generate` from `src/main/db/schema/approvals.ts`; three new tables, no rebuild). The next free number: the newest on `main` is `0003_job_kind_cutout`, and neither Phase 4 nor the look pack adds one.

```sql
CREATE TABLE approval_link (
  campaign_id   TEXT PRIMARY KEY REFERENCES campaign(id) ON DELETE CASCADE,
  slug          TEXT NOT NULL,                    -- 12 letters, as the service gave it
  state         TEXT NOT NULL CHECK (state IN ('live', 'ended')),
  created_at    TEXT NOT NULL,
  published_at  TEXT,                             -- last successful "Update gallery"
  checked_at    TEXT,                             -- last successful refresh
  ended_at      TEXT
);

CREATE TABLE approval_variant (                   -- what the gallery shows now
  campaign_id    TEXT NOT NULL REFERENCES approval_link(campaign_id) ON DELETE CASCADE,
  variant_id     TEXT NOT NULL REFERENCES variant(id) ON DELETE CASCADE,
  published_rev  INTEGER NOT NULL,
  expires_at     TEXT NOT NULL,                   -- when its signed picture address runs out
  PRIMARY KEY (campaign_id, variant_id)
);

CREATE TABLE approval_signoff (                   -- the last list read from the service
  id           TEXT PRIMARY KEY,                  -- the service's sign-off ID, 24 letters
  campaign_id  TEXT NOT NULL REFERENCES approval_link(campaign_id) ON DELETE CASCADE,
  variant_id   TEXT NOT NULL,                     -- no reference: a sign-off outlives a deleted variant
  version      INTEGER NOT NULL,
  email        TEXT NOT NULL,
  signed_at    TEXT NOT NULL
);
CREATE INDEX approval_signoff_campaign ON approval_signoff (campaign_id);
```

- **Side tables, not wire rows** (A-93). They are not in `ROW_KEYS`, `TableName` or `ROW_SCHEMAS`, never in `project.changed`, and the window store never holds them. The window reads them only through `approvals.forCampaign` and hears of changes through `approvals.changed`. So `tests/integration/expect-changes.ts` does not see them, and no existing command's event changes. A campaign delete removes them by cascade; that is not reported, since no window holds them.
- **One owner.** `src/main/approvals/local-store.ts` is the only code that reads or writes them. Every row read is checked with a Zod schema (the ID, slug, email and number rules below); a row that fails is skipped and logged with the table and campaign ID only.
- **Migration test** `tests/integration/db/migration-0004.test.ts`: opens a file with `bundledMigrations.slice(0, 5)`; `schema_version` 5; a file made at version 4 with a campaign, a variant and a job keeps every row; the three tables exist; `state` refuses `'paused'`; deleting the campaign removes its approval rows; deleting a variant removes its `approval_variant` row and keeps its sign-offs.

## Kept passwords

`src/main/approvals/password-store.ts` (A-85). Security class.

- File `{userData}/approval-passwords.bin`: one JSON map from `{projectId}/{campaignId}` to the password, encrypted as a whole with the same `SecretCrypto` as `secrets.bin` (`safeStorage`).
- The same rules as the secret store: no saving when encryption is not available ("This computer cannot store keys securely."); a file that does not decrypt to a JSON object is never written over (`RULE_VIOLATION`, reason `secrets_unreadable`, its sentence); written through a `.tmp` file and a rename.
- Kept so the user can copy the password again. Never in the project file, so a shared project carries no password: the other computer shows "The password is kept on the computer that made the link." and offers "Set a new password".
- The value leaves the main process only in `approvals.getPassword`'s reply to the window (user only) and in requests to the service.
- Removed when the link is turned off or replaced.

## Pictures

`src/main/approvals/picture-store.ts`, `s3-picture-store.ts`, `test-picture-store.ts`; `src/shared/approvals/picture-paths.ts`. Security class, full review.

```ts
type PictureStore = {
  put(path: string, png: Uint8Array): Promise<void>
  signedUrl(path: string, seconds: number): Promise<{ url: string; expiresAt: string }>
  list(folder: string): Promise<string[]>
  remove(paths: string[]): Promise<void>
}
```

- **Paths** (`picture-paths.ts`, the one owner): the folder `adman-approvals/{projectId}/{campaignId}/` and the file `{folder}{variantId}-{rev}.png`. Each part is checked before use (ULID, the campaign ID rule, the variant ID rule, a whole number); a failure throws "Storage path refused" and nothing is sent. **Nothing outside the campaign's folder is ever listed, written, signed or deleted** (named test).
- **S3** (`s3-picture-store.ts`): `put`, `list`, `remove` through the existing `StorageProvider` (`adapterFor(deps, 's3', 'storage')`, after `requireProviderKeys(deps, 's3', ...)`), so the S3 prefix, host pin and error rules apply unchanged. `signedUrl` calls a new optional method of the storage interface, `signedReadUrl?(path, seconds): Promise<string>` (`src/main/providers/types.ts`), implemented only by the S3 adapter with `@aws-sdk/s3-request-presigner` (`getSignedUrl` with `GetObjectCommand`), at most 604,800 seconds (7 days, the most S3 allows). The adapter checks that the signed address's host is one of `s3Hosts(bucket, region)` and refuses otherwise. Signing is done on this machine; it sends nothing.
- **The new package** `@aws-sdk/s3-request-presigner`, pinned to the version that matches `@aws-sdk/client-s3` (Apache-2.0). `npm ls @smithy/node-http-handler` must still show one copy.
- **A signed address holds the access key ID** (not the secret key) and a signature. It goes to the user's own service, which stores it and never shows it to a visitor (A-89). The app does not store it, log it or show it.
- **Test store** (`test-picture-store.ts`). Used only when `deps.devTools` is true and the core's environment has `ADMAN_APPROVALS_TEST_PICTURES` set to exactly `http://127.0.0.1:{port}`. It writes under `{userData}/approvals-test-pictures/` (made with the same `lstat` checks as the hand-test folder) and gives the address `{origin}/{path}` with an expiry 7 days on. Tests serve that folder from their own stand-in. A packaged app never uses it (A-97).
- **Which store.** `deps.approvals.pictures()` returns the test store under the condition above, else the S3 store. Nothing else chooses.

## Commands

All are deny for agents (A-96) and not undoable. Undo, agent and built columns as in `spec/api-commands.md`. The schemas are in `src/shared/schemas/commands/approvals.ts`; handlers in `src/main/commands/approvals/`.

| Command | Input | Undo | Agent | Built |
|---------|-------|------|-------|-------|
| `approvals.setService` | address (text or null) | — | deny | Not built (AP-6) |
| `approvals.check` | — | — | deny | Not built (AP-6) |
| `approvals.createLink` | projectId, campaignId, password? (12 to 128) | — | deny | Not built (AP-8) |
| `approvals.setPassword` | projectId, campaignId, password? | — | deny | Not built (AP-8) |
| `approvals.publish` | projectId, campaignId | — | deny | Not built (AP-9) |
| `approvals.refresh` | projectId, campaignId | — | deny | Not built (AP-9) |
| `approvals.endLink` | projectId, campaignId | — | deny | Not built (AP-8) |

`approvals.setService` and `approvals.check` are app-scope (no project transaction). The others are project-scope; their network work is in `prepare` (outside the transaction) and their table writes in `run`.

**Refusals every project-scope one shares, in this order** (`src/main/approvals/ready.ts`):

1. Unknown campaign: `NOT_FOUND`.
2. No address or no key: `RULE_VIOLATION`, reason `approvals_not_set_up`, "Add the approvals service address and key in Settings first."
3. For `createLink` and `publish` only: `storage.s3` null, or bucket or region empty: `RULE_VIOLATION`, reason `approvals_needs_bucket`, "Approval links need an Amazon S3 bucket for the pictures. Set one up in Settings, under Cloud storage." Then `requireProviderKeys(deps, 's3', ...)`, the one `NEEDS_KEY` guard.
4. Link state: `createLink` with a live link refuses (`RULE_VIOLATION`, `approval_link_exists`, "This campaign already has a link."); the others without a live link refuse (`RULE_VIOLATION`, `approval_link_missing`, "This campaign has no link yet.").

### `approvals.setService`

Checks the address with `parseApprovalsAddress(text, { allowLocalHttp: deps.devTools })`; null removes it. A refused address: `INVALID_INPUT` with the rule's sentence. Saves; sets `changesAppState`. Local links are not touched.

### `approvals.check`

Address and key present (else `approvals_not_set_up`); `GET /api/v1/health`; reply `{ ok: true }`. Failures as in the client table.

### `approvals.createLink`

1. The password: the given one (12 to 128 characters, no control character, else `INVALID_INPUT` "A password needs 12 to 128 characters, with no line breaks."), or one made by `makePassword()`: 16 letters from `23456789abcdefghjkmnpqrstuvwxyz` drawn without bias from `crypto.randomBytes`, shown in four groups of four joined by `-` (19 characters, about 79 bits).
2. `POST /api/v1/links` with the project ID, campaign ID, campaign name and password. On `409 link_exists` (a copy of this project made the link, or the local row was lost): `PUT .../password` with this password, then `GET` the link state, and take that link over.
3. `run`: write `approval_link` (state `live`, `created_at` now), replacing an `ended` row and deleting its old `approval_variant` and `approval_signoff` rows; keep the password in the password store.
4. Reply `{ slug }`. The dialog then sends `approvals.publish`.

### `approvals.setPassword`

The given password (same rule) or a made one; `PUT .../password` (the service ends every visitor session); keep it. Reply `{}`. No table changes.

### `approvals.publish` ("Update gallery")

All or nothing for the gallery (A-90).

1. The campaign's variants in the order `campaign.get` gives them. More than 500: `RULE_VIOLATION`, `too_many_variants`, "A gallery can show at most 500 variants."
2. For each variant whose current `rev` differs from its `approval_variant.published_rev` (or has no row): `deps.render.render(project, variantId, 1600)` (the PNG of the variant now, long side 1,600 px, `spec/scene.md` "The render service"); `put` it at `{variantId}-{rev}.png`, with the `rev` the draw returned. A variant whose `rev` is unchanged is not drawn or uploaded again.
3. `signedUrl` for every variant, 604,800 seconds.
4. `PUT .../gallery` with the campaign name, and per variant: `variantKey` (its ID), `title`, `sizeLine` (`{width}×{height} · {language} · {format}`, the tile's line), `version` (the `rev`), `pictureUrl`, `pictureExpiresAt`.
5. If step 2, 3 or 4 fails: the files uploaded in this run are removed (failures of that clean-up are logged, not reported), and the command fails; the gallery stays as it was. A failed draw: `RULE_VIOLATION`, `render_failed`, "A picture of {title} could not be drawn, so the gallery was not changed." with `details.variantId`. A storage failure: `PROVIDER_ERROR` with `details.provider: 's3'` and the provider's own sentence for its kind.
6. After success: `list` the campaign's folder and `remove` every file that is not one of the current `{variantId}-{rev}.png` names. A failure here is logged once and does not fail the command.
7. `run`: replace the campaign's `approval_variant` rows; set `published_at`. Then send `approvals.changed`.
8. Reply `{ variants: n, drawn: m }`.

Publishing is a command, not a job: the dialog waits with "Updating the gallery…" (A-90). Video variants are drawn as their still picture (left for later).

### `approvals.refresh`

Reads sign-offs back and keeps picture addresses fresh.

1. `GET` the link state.
2. **The link is gone** (`404`): `run` sets `state = 'ended'` and `ended_at`, deletes the `approval_variant` rows, keeps the sign-offs; the password is forgotten; `approvals.changed` is sent; the command fails with `RULE_VIOLATION`, `approval_link_gone`, "This link no longer exists on the approvals service, so it is shown as turned off. Make a new link to share again."
3. **Renewal:** for every `approval_variant` row whose `expires_at` is less than 2 days away and whose `published_rev` equals the service's `version` for it, sign the same file again for 7 days and send them in one `PUT .../pictures`. A renewal failure does not stop the refresh; it is logged, and tried again next time.
4. `run`: replace the campaign's `approval_signoff` rows with the service's list (each row checked again: `SIGNOFF_ID`, `VARIANT_KEY`, `EMAIL`, `VERSION`, `TIME`); update `expires_at` of renewed rows; set `checked_at`.
5. Send `approvals.changed` only when the sign-off list, the state or an expiry changed. Reply `{ changed: boolean }`.

### `approvals.endLink` ("Turn off link")

1. `GET` the link state (a last read of sign-offs). If the link is already gone, carry on as below without the service steps.
2. `DELETE` the link on the service (gallery, sign-offs and sessions go with it).
3. `list` and `remove` every file in the campaign's picture folder. A failure is logged once and does not fail the command.
4. `run`: `state = 'ended'`, `ended_at` now; sign-offs replaced with the last read and kept; `approval_variant` rows deleted. Forget the password. Send `approvals.changed`.

A later `createLink` for the campaign makes a new link with a new slug and clears the kept sign-offs (A-94).

## Queries and the event

| Query | Input | Reply | Who |
|-------|-------|-------|-----|
| `approvals.forCampaign` | projectId, campaignId | `ApprovalsForCampaign` (below) | User only; an agent gets `AGENT_DENIED` "Agents cannot read approvals in this version. Ask the user to do it in the app." |
| `approvals.getPassword` | projectId, campaignId | `{ password: string \| null }` | User only, the same refusal |

```ts
type ApprovalsForCampaign = {
  ready: 'ready' | 'no_service' | 'no_bucket'   // no_service: address or key missing; no_bucket: S3 settings or keys missing
  link: null | {
    state: 'live' | 'ended'
    address: string | null        // `{baseUrl}/l/{slug}`; null when no address is set
    createdAt: string
    publishedAt: string | null
    checkedAt: string | null
    endedAt: string | null
    passwordKept: boolean
  }
  variants: Array<{               // every variant of the campaign, in campaign.get order
    variantId: string
    currentRev: number
    publishedRev: number | null   // null: not in the gallery
    signoffs: Array<{ id: string; email: string; signedAt: string; version: number; current: boolean }>
  }>                              // current: version equals publishedRev
}
```

- Approvals data is never added to `campaign.get`, `variant.get` or any MCP tool's reply (agents read those).
- **Event** `approvals.changed`: `{ projectId, campaignId }`, sent to the app window only, after a command changed the local tables. It carries no email, slug or address. Added to `EventMap` and `EVENT_NAMES` (`src/shared/schemas/events.ts`).

## Versions and marks

A variant's version is its `rev` (A-91). It changes with every saved edit of the variant or its layers, and with nothing else.

`approvalMarks(entry, linkState)` (`src/shared/approvals/marks.ts`, pure) gives a tile's marks:

| Situation | Mark |
|-----------|------|
| No link, or the variant has no row and no sign-off | none |
| In the gallery, `currentRev` equals `publishedRev`, with n current sign-offs (n ≥ 1) | "Signed off by {n}" |
| `currentRev` differs from `publishedRev`, with at least one current sign-off | "Signed off by {n}" and "Changed since sign-off" |
| `currentRev` differs from `publishedRev`, no current sign-off | "Changed since published" |
| Live link, the variant has no row | "Not in the gallery" |
| Only earlier-version sign-offs | "Earlier version signed off" |

A sign-off belongs to the version it was given for. After a change and a new "Update gallery", the older sign-offs stay, listed as "for an earlier version" in the gallery and in the app.

## Screens

D-084: one folder per component, CSS from the existing tokens only (no slice of this feature adds a token), data by props or a store. Shots in `tests/shots/ap-*.shots.ts`, pictures numbered 90 to 99. All text from the service (emails) and from the project is drawn as text.

### Settings

- **"Approvals service"** (`src/renderer/screens/settings/approvals-section/`): the line "Share a campaign's variants with a password-protected link and see who signed off. The service runs on your own Cloudflare account." A "Service address" field with "Save" and "Remove" (`approvals.setService`; a refusal's sentence under the field). A "Service key" row (`secret.set` and `secret.delete` with `approvals.apiKey`, last four shown, the field is a password field). "Test connection" (`approvals.check`): "Connected." or the failure's sentence. The line "Pictures for the gallery are kept in your Amazon S3 bucket (Cloud storage, above)."
- **"Cloud storage"** (`s3-section/`): see "Cloud storage: the S3 part", above.
- Mounted in `settings-screen.tsx` after the keys section: Cloud storage, then Approvals service.

### The campaign page

- **Approval bar** (`src/renderer/screens/campaign/approval-bar/`), in the page's header row: the button "Approval link…". With a live link: "Signed off: {a} of {b} variants" (variants with at least one current sign-off, of those in the gallery), "Checked {time}" and a "Refresh" button. After a failed refresh: the failure's sentence in place of "Checked". With an ended link: "Link turned off".
- **Store** (`src/renderer/stores/approvals-store.ts`, one per campaign page): holds the `approvals.forCampaign` reply; reads it again on `approvals.changed` for its campaign and on `project.changed` for its project (revs change the marks). While the link is live and `ready` is `ready`, it sends `approvals.refresh`: once when the page opens, every 60 seconds while the window has focus, when the window gains focus, and on "Refresh" (A-92). One refresh at a time; a refresh asked for while one runs is dropped. The background refresh goes through `api.command` directly and shows its failure only in the bar, never in the error banner. `approval_link_gone` reads the query again. The timer stops when the page closes.
- **Tile marks** (`src/renderer/screens/campaign/approval-mark/`): under each tile, beside it and not inside the tile's button, the marks of `approvalMarks` and, when the variant has sign-offs, a "Sign-offs ({n})" toggle (`aria-expanded`) showing the list. `VariantTile` gains an optional `footer` prop drawn after the button; `VariantGrid` gains an optional `tileFooter(variant)` prop; both a few lines.
- **Sign-off list** (`src/renderer/ui/signoff-list/`): one line per sign-off, newest first: "{email} · {date and time}" and, for an older version, "· for an earlier version". Used by the tile and the dialog.

### The approval link dialog

`src/renderer/dialogs/approval-dialog/`, on the dialog frame. Title "Approval link". All buttons that send are disabled while a command runs, with "Working…" beside them.

- **Not ready.** `no_service`: "Set up the approvals service in Settings to make links." `no_bucket`: the `approvals_needs_bucket` sentence. Button "Open Settings".
- **No link.** "Make a link that shows this campaign's variants to reviewers. They need the link and the password. Anyone who has both can sign off on a variant with their email address, or remove a sign-off." Two choices: "Make a password for me" (default) and "Choose a password" (a password field, "At least 12 characters."). Button "Make link": `approvals.createLink`, then `approvals.publish`.
- **Live link.**
  - "Link": the address in a read-only field, "Copy link".
  - "Password": "Copy password" (reads `approvals.getPassword` on click, copies, shows "Copied."; the password is never drawn), or, when not kept, "The password is kept on the computer that made the link." Then "Set a new password…": the two choices again and "People who already opened the link must enter the new password." Button "Set password".
  - "Gallery": "Updated {time}." and "{n} variants changed since." when n > 0. Button "Update gallery" (`approvals.publish`; "Updating the gallery…" while it runs).
  - The sign-off list of every variant, by variant title.
  - "Turn off link…" opens a confirmation: "Turn off this link? Reviewers can no longer open it. The gallery and its pictures are deleted from the service and your bucket. Sign-offs so far stay in this project." Buttons "Keep link" (focused) and "Turn off link".
  - "If you delete this campaign, turn its link off first." (A-100)
- **Ended link.** "This link was turned off on {date}. Its sign-offs are kept below." Button "Make a new link" with "Sign-offs from the old link will be removed from this project."
- Copy uses `navigator.clipboard.writeText` on click (the one permission the app allows).

## Security

Project rule: in scope are attacks that destroy, that reach sensitive data, or that give unexpected power; nuisance is noted at most (`spec/security.md`, "Scope"). This feature sends work out of the machine and holds other people's email addresses, so most of its slices are security class. These rules live here because `spec/security.md` is at its size limit; that file should point here when it is next split.

### Threats

| Threat | What stops it |
|--------|---------------|
| Guessing a slug | 12 letters from 62 (about 3 × 10^21). A slug alone opens only the password page, the same page an unknown slug gets |
| Guessing a password | PBKDF2-SHA-256, 100,000 iterations, salted per link; 10 tries per link per 15 minutes; the app's made password is about 79 bits; a chosen one has at least 12 characters (A-86) |
| A copy of the service's database | Passwords only as slow salted hashes; sessions only as hashes; picture addresses run out within 7 days and hold no secret key |
| The service key stolen | It controls every link on that service: read emails, change or delete galleries, set picture addresses (only S3 hosts are fetched). Kept only in `secrets.bin` and the Worker's secret; never in a project, log, event, reply or the window beyond the last four. Replaced by a new `wrangler secret put` and the new key in Settings |
| A visitor's text run as script (on the page or in the app) | Every value escaped by one template; pages carry no script and a policy that allows none; emails ASCII only; the app draws every value as text |
| Another site sending forms as a visitor | `SameSite=Lax` cookie; `Origin` must equal the service's own; `Sec-Fetch-Site`; form content type; `frame-ancestors 'none'` |
| The service made to fetch addresses it should not | Addresses come only through the keyed API; `https` and the two S3 host forms only; no redirects followed; size and picture-type checks; the test origin only when a test sets it |
| Another campaign's data read through a link | The session names its link; every query filters by that link; the picture route checks link, variant and version; API routes are keyed by project and campaign |
| The slug leaking through `Referer` | `Referrer-Policy: no-referrer`; the pages load nothing from elsewhere |
| A visitor's session stolen | `__Host-` cookie, `HttpOnly`, `Secure`, 12 hours; ended by "Leave", a new password, or turning the link off |
| The bucket address or keys reaching a visitor | The service fetches the picture and passes on only its bytes; the signed address stays in its database |
| A shared project file carrying a link | It carries the slug, the publish state and sign-off emails; never the password, the key or the service address. Another person needs the service key to act on the link |
| A hostile project file steering requests | Every project-file value below is checked before it reaches a request or a storage path |
| The key sent to the wrong place | `https` only, no redirects, the address set only by the user through one command agents cannot send |
| An agent publishing work or reading emails | Every approvals command deny; both queries user only; no tool returns approvals data |

### Project-file values that reach a request or a path

To be added to the table in `spec/security.md`, "Project-file values that reach a path, a header or a request", when that file is next edited.

| Value from the project file | Where it goes | File | Check before use | Left open |
|---|---|---|---|---|
| `project_id`, `campaign.id` | API path `/api/v1/links/{p}/{c}`; picture folder | `src/main/approvals/client.ts`, `picture-paths.ts` | `PROJECT_ID`, `CAMPAIGN_ID` rules | A file copying another project's IDs reaches that link only with the same service key (accepted) |
| `approval_variant.variant_id`, `published_rev` | Picture file name; signing; removal | `picture-paths.ts` | Variant ID rule, whole number; only inside the campaign's folder | None |
| `approval_link.slug` | The link address shown and copied | `src/main/queries/approvals.ts` | `SLUG` rule; a failing row is skipped | None |
| `approval_signoff.*` | Shown in the window | `local-store.ts` | Zod on read (`EMAIL`, IDs, numbers, time) | None |
| `campaign.name`, `variant.title` | Sent to the service, shown to visitors | `publish.ts` | `SHOWN_TEXT` (control and direction characters refused, length); escaped by the service | Names are the user's own words, sent on purpose |

### Rules a developer must not break

- No approvals command or query is ever `allow`, `ask` or `tick` without a ruling. No MCP tool returns approvals data, a slug or a link address.
- The key, a password, a signed picture address, a slug and an email never appear in a log line, an error message, an event, or a test's output. Logs hold IDs, counts, route names and error kinds.
- `approvals.baseUrl` has one writer; the address rule refuses plain `http` except the dev-tools test case.
- No redirect is followed by the client or by the service's picture fetch.
- Picture storage touches only `adman-approvals/{projectId}/{campaignId}/`.
- Visitor pages carry no script; their policy and headers are compared whole in tests.
- Data at rest: emails and slugs sit in the project file unencrypted, like all project data. Passwords sit in `approval-passwords.bin`, encrypted.

### Accepted, noted

- A visitor who has the link can lock other reviewers out for 15 minutes at a time (nuisance).
- Anyone with the link and password sees every email that signed off, and can remove any sign-off [D-095].
- A campaign deleted with a live link leaves the link and its pictures in place (A-100).
- Many sign-offs or a very large gallery make pages slow (nuisance; 500 variants is a contract limit, not a protection).
- Sign-off emails travel with a shared or packaged project file.

### Named tests

| Test | What it proves |
|------|----------------|
| `tests/unit/shared/approvals/address.test.ts` | Table: `https` origins pass and are stored as origins; `http`, IP addresses, `localhost`, a path, a query, user info, a single-label host refused; `http://127.0.0.1:{port}` only with `allowLocalHttp` |
| `tests/unit/main/settings/settings-store-approvals.test.ts` | A failing address loads as null and is wiped at the next save; `__proto__` in `approvals` adds nothing |
| `tests/integration/approvals/client.test.ts` | Against the stand-in: the key only in `Authorization`; a redirect not followed; a 5 MiB reply refused; a reply of the wrong shape is `other`; the stand-in on plain `http` refused without dev tools; no log line holds the key, address or a body |
| `tests/integration/approvals/picture-paths.test.ts` | Bad IDs refused before any call; a publish and an end touch nothing outside the campaign's folder (a test store over a temporary folder with a file planted beside it) |
| `tests/unit/main/providers/s3/signed-url.test.ts` | The signed address's host is one of `s3Hosts`; 604,801 seconds refused; the secret key is not in the address |
| `tests/integration/approvals/agent-denied.test.ts` | Every approvals command as the agent: `AGENT_DENIED`, nothing sent to the stand-in; both queries refuse the agent |
| `tests/integration/mcp/secret-leak.test.ts` (approved addition) | The approvals address, key and a sign-off email planted: none appears in any tool reply |
| `tests/unit/config/approvals-contract.test.ts` | The two contract files are byte-equal; the two `zod` versions are equal |
| Service tests | `spec/approvals-service.md`, "Tests" |

## Assumptions

Made to keep the build moving under D-082. Each says how hard it is to undo.

- **A-82. One service, the app never touches the database.** A Worker with D1 holds links, hashed passwords, gallery rows, sign-offs and sessions; the app talks to it over HTTPS with one key. *AP-1. Change later: hard.*
- **A-83. The contract is shared by a byte-equal copy** checked by a root test, so neither build imports the other's code. *AP-1. Easy.*
- **A-84. Links are found by project ID and campaign ID,** one per campaign; a copy of a project on another computer with the same service manages the same link. *AP-2, AP-8. Medium.*
- **A-85. The password is kept** in `{userData}/approval-passwords.bin`, encrypted, never in the project file; the app makes one by default (16 letters in four groups); a chosen one has 12 to 128 characters. *AP-6, AP-8. Easy.*
- **A-86. Password checks:** PBKDF2-SHA-256 at 100,000 iterations (the Workers limit), 10 tries per link per 15 minutes, one reply for unknown slug, wrong password and too many tries. *AP-2, AP-3. Easy.*
- **A-87. Sessions** are rows in D1 with a 12-hour `__Host-` cookie per link, `SameSite=Lax`; a new password or turning off ends them. *AP-3. Easy.*
- **A-88. No script on the visitor pages:** plain forms and redirects, stricter than "a little script". *AP-3. Easy.*
- **A-89. Pictures:** a 1,600 px PNG per variant in the user's S3 bucket, signed for 7 days, renewed by refresh when under 2 days remain; the service fetches only S3 hosts; R2 may replace this behind `PictureSource` (OI-96). *AP-4, AP-7, AP-9. Medium.*
- **A-90. "Update gallery" is a command, not a job,** all or nothing, and draws only variants that changed. *AP-9. Medium (a job kind needs a migration).*
- **A-91. A variant's version is its `rev`.** *AP-9. Easy.*
- **A-92. Reading sign-offs back:** a full replace on each refresh; every 60 s while the campaign page is shown and the window has focus, on focus, and on "Refresh". *AP-9, AP-11. Easy.*
- **A-93. Approval tables are main-only side tables,** not wire rows, with their own event; emails travel in the project file. *AP-5. Medium.*
- **A-94. Turning a link off** deletes it, its gallery, sign-offs and sessions on the service and its pictures in the bucket; the app keeps its last read of sign-offs until a new link is made. *AP-8. Easy.*
- **A-95. The S3 part of Settings' "Cloud storage"** is built ahead of Phase 9 (OI-97). *AP-10a (built); AP-10b.*
- **A-96. Agents:** every approvals command deny, both queries user only. *AP-5. Easy.*
- **A-97. Local test doors:** plain `http` to `127.0.0.1` and a folder picture store only in an unpackaged app with dev tools on; the service's `TEST_PICTURE_ORIGIN` only in tests. *AP-6, AP-7, AP-4. Easy.*
- **A-98. The service key shows its last four** characters like every other key, not only "set / not set". *AP-5. Easy.*
- **A-99. Emails are ASCII only** and shown to every visitor (OI-95). *AP-1. Easy.*
- **A-100. Deleting a campaign leaves its link** on the service; the dialog says to turn it off first. *AP-11. Easy.*

## Left for later

- **Video variants** are shown by their still picture (the draw at time 0). A moving preview waits for Phase 7 and export.
- **R2 instead of S3** for pictures (no 7-day limit, no bucket setup): a new `PictureSource` in the service and a new picture store in the app (OI-96).
- **A job with progress** for galleries of hundreds of variants, once Phase 5 brings them.
- **Links of deleted campaigns:** a list in Settings to turn them off.
- **MCP tools** for approvals, if ever (Phase 10 decides; deny until then).
- Comments with a sign-off, an email kept for the visitor's next sign-off, links that end on a date, international email addresses.
