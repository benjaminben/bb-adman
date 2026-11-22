# Approvals: the service client, local tables, kept passwords, pictures

The desktop app's lower layer for approval links [D-095]: how it talks to the service, the tables it keeps, the passwords it keeps, and the pictures it puts in the user's bucket. Read with `spec/approvals.md` (the overview, Settings, screens, security rules, assumptions A-82 on) and `spec/approvals-commands.md` (the commands, queries and the event that use these parts). Slices: `spec/phases/approvals-desktop-slices.md`.

## The service client

**Built (AP-6).** `src/main/approvals/client.ts`, `request.ts`, `failure.ts`. Security class, full review.

- **One function per API route** of `spec/approvals-service-data.md`, "The keyed API", each taking the origin and the key from its caller (read from settings and secrets at the start of each command, never kept between commands).
- **How it sends.** Node's `https` (`http` only for the local test exception), with its own `Agent` (`keepAlive: false`, `rejectUnauthorized: true`, no proxy from the environment), the same pattern as the ComfyUI client. Host and port come only from the saved origin; the path only from the route table with IDs that passed their rule.
- **The address is checked before any connection.** The saved host name is resolved first, and the address it resolves to is checked. An address in a loopback or private range is refused. IPv6 forms that carry an IPv4 address (IPv4-mapped, NAT64, 6to4) are judged by the IPv4 address inside them, or refused when that cannot be read. The socket connects to the checked address only, so no second lookup can change it. The TLS server name (and the certificate check) is the saved host. A refused address sends nothing and fails as kind `offline`. The one exception is the local test address `http://127.0.0.1:{port}`, accepted only under the dev-tools rule of `spec/approvals.md`, "The service address".
- **No proxy, no redirects.** A `3xx` is a failure of kind `other`. Node's `https` follows none by itself; the client adds none.
- **Limits** (nuisance numbers): 20 s for the whole request; reply body at most 4 MiB, read with a cap.
- **Every reply is checked** with the contract's schema (`src/shared/approvals/contract.ts`). A reply that fails is kind `other`. Text from the reply is never put into an error message, a log line or the window, except the fields the contract allows (`slug`, emails, IDs, times), and those only through the local tables.
- **A key of the wrong shape is never sent.** A saved service key that fails the key shape check refuses as `approvals_not_set_up` (`ready.ts`, `spec/approvals-commands.md` "Refusals"), with no request.
- **Failures** become `PROVIDER_ERROR` with `details = { service: 'approvals', kind }`. The kinds are `bad_key`, `not_set_up`, `offline`, `timeout` and `other`:

| Answer | `kind` | Message |
|--------|--------|---------|
| `401 bad_key` | `bad_key` | "The approvals service did not accept the key. Check the key in Settings." |
| `503 not_set_up` | `not_set_up` | "The approvals service has no key of its own yet. Finish its setup steps first." |
| No connection, name not found, TLS failure, an address in a refused range | `offline` | "The approvals service could not be reached. Check the address and your connection." |
| Time limit | `timeout` | "The approvals service took too long to answer. Try again." |
| Health with another contract number | `other` | "The approvals service is a different version from this app." |
| Anything else (bad shape, `3xx`, `5xx`, `400`) | `other` | "The approvals service gave an answer the app does not understand." |

- `404 not_found` on a link route is not a failure: the caller handles it (`spec/approvals-commands.md`, "Half-done states" and `approvals.refresh`).
- **Logs.** One line per failure: `name: 'approvals.request'`, the route name (`health`, `createLink`, ...), the `kind`, the HTTP status. Never the address, the key, a body, a slug, an email or a picture address.
- **Tests** (AP-6): `tests/integration/approvals/client.test.ts` (the named cases in `spec/approvals.md`, "Named tests"); `tests/integration/approvals/client-network.test.ts` (the address check before connecting, each refused range and IPv6 form, the pinned socket, the TLS server name); `tests/integration/approvals/ready.test.ts` (the shared refusals, the key shape); `tests/unit/main/approvals/request.test.ts` (the request: limits, the body cap, no redirect).
- **Accepted, not built** (AP-6 review):
  - The saved address is loaded without the dev-tools flag check. Adding it would need edits to `settings-store.ts` and `core.ts`.
  - A note on a symlink at the password store's `.tmp` path.
  - A note on the request's time limit timer.

## Local tables

**Built:** the schema and migration (AP-5); `local-store.ts` (AP-8, built).

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

**Built (AP-6).** `src/main/approvals/password-store.ts` (A-85). Security class.

- File `{userData}/approval-passwords.bin`: one JSON map from `{projectId}/{campaignId}` to the password, encrypted as a whole with the same `SecretCrypto` as `secrets.bin` (`safeStorage`).
- The same rules as the secret store: no saving when encryption is not available ("This computer cannot store keys securely."); a file that does not decrypt to a JSON object is never written over (`RULE_VIOLATION`, reason `secrets_unreadable`, its sentence); written through a `.tmp` file and a rename.
- **Asked before sending** (built: `canKeep()` in `src/main/commands/approvals/password-input.ts`): the store can say whether encryption is available without writing anything. `approvals.createLink` and `approvals.setPassword` ask it before their first request and refuse with the store's own refusal and sentence above (`spec/approvals-commands.md`, "Refusals").
- Kept so the user can copy the password again. Never in the project file, so a shared project carries no password: the other computer shows "The password is kept on the computer that made the link." and offers "Set a new password".
- The value leaves the main process only in `approvals.getPassword`'s reply to the window (user only) and in requests to the service.
- Removed when the link is turned off or replaced.

## Pictures

**Built (AP-7).** `src/main/approvals/picture-store.ts`, `s3-picture-store.ts`, `test-picture-store.ts`; `src/shared/approvals/picture-paths.ts`. Security class, full review.

```ts
type PictureStore = {
  put(path: string, png: Uint8Array): Promise<void>
  signedUrl(path: string, seconds: number): Promise<{ url: string; expiresAt: string }>
  list(folder: string): Promise<string[]>
  remove(paths: string[]): Promise<void>
}
```

- **Paths** (`picture-paths.ts`, the one owner): the folder `adman-approvals/{projectId}/{campaignId}/` and the file `{folder}{variantId}-{rev}.png`. Each part is checked before use (ULID, the campaign ID rule, the variant ID rule, a whole number); a failure throws "Storage path refused" and nothing is sent. **Nothing outside the campaign's folder is ever listed, written, signed or deleted** (named test).
- **Not tied to one campaign.** A picture store is made once and takes whole paths; every call checks its paths. **One `remove` call stays inside one campaign folder:** a list of paths from two folders is refused before anything is deleted.
- **S3** (`s3-picture-store.ts`): `put`, `list`, `remove` through the existing `StorageProvider` (`adapterFor(deps, 's3', 'storage')`, after `requireProviderKeys(deps, 's3', ...)`), so the S3 prefix, host pin and error rules apply unchanged. `signedUrl` calls a new optional method of the storage interface, `signedReadUrl?(path, seconds): Promise<string>` (`src/main/providers/types.ts`), implemented only by the S3 adapter with `@aws-sdk/s3-request-presigner` (`getSignedUrl` with `GetObjectCommand`), at most 604,800 seconds (7 days, the most S3 allows). A lifetime outside that range is an error: it throws, and is never shortened to fit. Signing is done on this machine; it sends nothing.
- **The signed address is checked before it is returned** (`signed-url.ts`), in its written form: the address is parsed, and the parsed address must write back to exactly the same text. Its host must be one of `s3Hosts(bucket, region)`. Its query holds only the signer's own `X-Amz-*` names, plus at most two extra fields with fixed values, `x-id=GetObject` and `x-amz-checksum-mode=ENABLED`. Its credential must end `/{region}/s3/aws4_request`, with the saved region. Anything else is refused.
- **The new package** `@aws-sdk/s3-request-presigner`, pinned to the version that matches `@aws-sdk/client-s3` (Apache-2.0). `npm ls @smithy/node-http-handler` must still show one copy.
- **A signed address holds the access key ID** (not the secret key) and a signature. It goes to the user's own service, which stores it and never shows it to a visitor (A-89). The app does not store it, log it or show it.
- **Test store** (`test-picture-store.ts`). Used only when dev tools are on (`deps.devTools`) and the core's environment has `ADMAN_APPROVALS_TEST_PICTURES` set to exactly `http://127.0.0.1:{port}`. It writes under `{userData}/approvals-test-pictures/` (made with its own `lstat` checks: a link or a file in its place is refused; an `lstat` error is a `ProviderFailure` of kind `other` with the code only) and gives the address `{origin}/{path}` with an expiry 7 days on. Tests serve that folder from their own stand-in. A packaged app never uses it (A-97).
- **Which store.** `deps.approvals.pictures()` returns the test store under the condition above, else the S3 store. Nothing else chooses.
