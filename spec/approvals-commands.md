# Approvals: commands, queries and the event

The desktop app's commands and queries for approval links [D-095]. Read with `spec/approvals.md` (the overview, Settings, screens, security rules, assumptions A-82 on) and `spec/approvals-client.md` (the service client, local tables, kept passwords and pictures these commands use). Slices: `spec/phases/approvals-desktop-slices.md`.

## Commands

All are deny for agents (A-96) and not undoable. Undo, agent and built columns as in `spec/api-commands.md`. The schemas are in `src/shared/schemas/commands/approvals.ts`; handlers in `src/main/commands/approvals/`.

| Command | Input | Undo | Agent | Built |
|---------|-------|------|-------|-------|
| `approvals.setService` | `{ address: string \| null }` | — | deny | Built (AP-6) |
| `approvals.check` | — | — | deny | Built (AP-6) |
| `approvals.createLink` | projectId, campaignId, password? (12 to 128) | — | deny | Built (AP-8) |
| `approvals.setPassword` | projectId, campaignId, password? | — | deny | Built (AP-8) |
| `approvals.publish` | projectId, campaignId | — | deny | Not built (AP-9) |
| `approvals.refresh` | projectId, campaignId | — | deny | Not built (AP-9) |
| `approvals.endLink` | projectId, campaignId | — | deny | Built (AP-8) |

`approvals.setService` and `approvals.check` are app-scope (no project transaction). The others are project-scope; their network work is in `prepare` (outside the transaction) and their table writes in `run`. A throw inside `run` rolls the whole transaction back, so a command that must keep its writes and still report a problem returns a value instead of throwing (`approvals.refresh`, below).

**Sending the event.** Commands have no other way to send an event, so `ApprovalsDeps` has `changed(projectId, campaignId)`: it sends `approvals.changed` with only those two IDs. Every command that changes what `approvals.forCampaign` returns calls it once, after its writes. **After the commit** (built, AP-8): `src/main/approvals/after-commit.ts` sends `approvals.changed`, and forgets a kept password, only once the command's transaction is confirmed committed, so a rolled-back command sends no event. Every approvals command sends its event and forgets passwords through this step, never inside `run`.

### Refusals

**The password check runs first** (`createLink` and `setPassword`): see "The password input", below.

**Then the refusals every project-scope command shares, in this order** (`src/main/approvals/ready.ts`):

1. Unknown campaign: `NOT_FOUND`.
2. The service: no address, no key, or a saved key of the wrong shape: `RULE_VIOLATION`, reason `approvals_not_set_up`, "Add the approvals service address and key in Settings first."
3. The bucket, for `createLink` and `publish` only: `storage.s3` null, or bucket or region empty: `RULE_VIOLATION`, reason `approvals_needs_bucket`, "Approval links need an Amazon S3 bucket for the pictures. Set one up in Settings, under Cloud storage."
4. The S3 keys, for `createLink` and `publish` only: `requireProviderKeys(deps, 's3', ...)`, the one `NEEDS_KEY` guard.
5. Link state: `createLink` with a live link refuses (`RULE_VIOLATION`, `approval_link_exists`, "This campaign already has a link."); the others without a live link refuse (`RULE_VIOLATION`, `approval_link_missing`, "This campaign has no link yet.").

**Then, for `createLink` and `setPassword`, secure storage** (built): if `PasswordStore.canKeep(): boolean` says encryption is not available, the command refuses with the store's own refusal, "This computer cannot store keys securely.", before its first request. Without this check, `createLink` fails only after the service made the link, and each retry repeats that; `setPassword` would change the password on the service and keep it nowhere (`spec/approvals.md`, "Open items").

### The password input

Ruled as the design. The shared command schema in `src/shared/schemas/commands/approvals.ts` is left as it is. The command builds its own input schema from the campaign input (`projectId`, `campaignId`) plus `password: string, optional`, and checks a chosen password itself: 12 to 128 characters, no control character. A refusal is `INVALID_INPUT` with the fixed sentence "A password needs 12 to 128 characters, with no line breaks." and never holds the text, in its message or its details. With no password given, `makePassword()` makes one: 16 letters from `23456789abcdefghjkmnpqrstuvwxyz` drawn without bias from `crypto.randomBytes`, shown in four groups of four joined by `-` (19 characters, about 79 bits).

### `approvals.setService`

**Built (AP-6).** Input `{ address: string | null }`; reply `{ baseUrl }`. Checks the address with `parseApprovalsAddress(text, { allowLocalHttp: deps.devTools })`; null removes it. A refused address: `INVALID_INPUT` with the rule's sentence. Saves; sets `changesAppState`. Local links are not touched.

### `approvals.check`

**Built (AP-6).** Address and key present (else `approvals_not_set_up`); `GET /api/v1/health`; reply `{ ok: true }`. Failures as in the client table (`spec/approvals-client.md`, "The service client").

### `approvals.createLink`

1. The password: the given one, checked as in "The password input", or a made one.
2. `POST /api/v1/links` with the project ID, campaign ID, campaign name and password. On `409 link_exists` (a copy of this project made the link, or the local row was lost): `PUT .../password` with this password, then `GET` the link state, and take that link over.
3. `run`: write `approval_link` (state `live`, `created_at` now, a taken-over link included), replacing an `ended` row and deleting its old `approval_variant` and `approval_signoff` rows; keep the password in the password store; `changed`.
4. Reply `{ slug }`. The dialog then sends `approvals.publish`.

### `approvals.setPassword`

The given password (same rule) or a made one; `PUT .../password` (the service ends every visitor session); keep it. Reply `{}`. No table changes.

- **The service answers `404`:** `RULE_VIOLATION`, reason `approval_link_gone`; nothing changes locally.
- **The event** (built): after a successful `PUT`, it sends `approvals.changed` through the after-commit step, because `passwordKept` in `approvals.forCampaign` can change.

### Half-done states

A command whose service step worked but whose local write failed leaves the two sides apart. Each recovers on the next press:

- **Link made on the service, local write failed.** No live local row, so the next "Make link" sends `POST` again and gets `409`; it sets the new password, reads the link and takes it over (`created_at` now).
- **Delete done on the service, local write failed.** The local row is still live, so the next "Turn off link" finds the link gone (`404`) and ends it locally, without the service steps. The sign-offs of that last read are lost: the service copy is gone and the local write did not land. Accepted.

### `approvals.publish` ("Update gallery")

All or nothing for the gallery (A-90).

1. The campaign's variants in the order `campaign.get` gives them. More than 500: `RULE_VIOLATION`, `too_many_variants`, "A gallery can show at most 500 variants."
2. For each variant whose current `rev` differs from its `approval_variant.published_rev` (or has no row): `deps.render.render(project, variantId, 1600)` (the PNG of the variant now, long side 1,600 px, `spec/scene.md` "The render service"); `put` it at `{variantId}-{rev}.png`, with the `rev` the draw returned. A variant whose `rev` is unchanged is not drawn or uploaded again.
3. `signedUrl` for every variant, 604,800 seconds.
4. `PUT .../gallery` with the campaign name, and per variant: `variantKey` (its ID), `title`, `sizeLine` (`{width}×{height} · {language} · {format}`, the tile's line), `version` (the `rev`), `pictureUrl`, `pictureExpiresAt`.
5. If step 2, 3 or 4 fails: the files uploaded in this run are removed (failures of that clean-up are logged, not reported), and the command fails; the gallery stays as it was. A failed draw: `RULE_VIOLATION`, `render_failed`, "A picture of {title} could not be drawn, so the gallery was not changed." with `details.variantId`. A storage failure: `PROVIDER_ERROR` with `details.provider: 's3'` and the provider's own sentence for its kind.
6. After success: `list` the campaign's folder and `remove` every file that is not one of the current `{variantId}-{rev}.png` names. A failure here is logged once and does not fail the command.
7. `run`: replace the campaign's `approval_variant` rows; set `published_at`. Then `approvals.changed` through the after-commit step.
8. Reply `{ variants: n, drawn: m }`.

Publishing is a command, not a job: the dialog waits with "Updating the gallery…" (A-90). Video variants are drawn as their still picture (left for later).

### `approvals.refresh`

Reads sign-offs back and keeps picture addresses fresh. Reply `{ changed: boolean; gone: boolean }`.

1. `GET` the link state.
2. **The link is gone** (`404`): `run` sets `state = 'ended'` and `ended_at`, deletes the `approval_variant` rows and keeps the sign-offs. It does not throw, since a throw inside `run` would roll these writes back: the writes commit and the command returns `{ changed: true, gone: true }`. Forgetting the password and `approvals.changed` go through the after-commit step, as in `endLink`, not inside `run`. The window shows the `approval_link_gone` sentence from `messages.ts`, "This link no longer exists on the approvals service, so it is shown as turned off. Make a new link to share again." No other step runs.
3. **Renewal:** for every `approval_variant` row whose `expires_at` is less than 2 days away and whose `published_rev` equals the service's `version` for it, sign the same file again for 7 days and send them in one `PUT .../pictures`. A renewal failure does not stop the refresh; it is logged, and tried again next time.
4. `run`: replace the campaign's `approval_signoff` rows with the service's list (each row checked again: `SIGNOFF_ID`, `VARIANT_KEY`, `EMAIL`, `VERSION`, `TIME`); update `expires_at` of renewed rows; set `checked_at`.
5. Send `approvals.changed`, through the after-commit step, only when the sign-off list, the state or an expiry changed. Reply `{ changed, gone: false }`.

### `approvals.endLink` ("Turn off link")

1. `GET` the link state (a last read of sign-offs). If the link is already gone, carry on as below without the service steps.
2. `DELETE` the link on the service (gallery, sign-offs and sessions go with it).
3. `list` and `remove` every file in the campaign's picture folder. A failure is logged once and does not fail the command.
4. `run`: `state = 'ended'`, `ended_at` now; sign-offs replaced with the last read and kept; `approval_variant` rows deleted.
5. After the commit (the after-commit step): forget the kept password, best effort, and send `approvals.changed`. A failed forget is logged by its kind only (no password, slug or email) and does not fail the command. Why: a throw inside the transaction rolled it back and lost the last-read sign-offs after the service copy was already deleted.

A later `createLink` for the campaign makes a new link with a new slug and clears the kept sign-offs (A-94).

## Queries and the event

**Built (AP-8).**

| Query | Input | Reply | Who |
|-------|-------|-------|-----|
| `approvals.forCampaign` | projectId, campaignId | `ApprovalsForCampaign` (below) | User only; an agent gets `AGENT_DENIED` "Agents cannot read approvals in this version. Ask the user to do it in the app." An unknown campaign: `NOT_FOUND` |
| `approvals.getPassword` | projectId, campaignId | `{ password: string \| null }` | User only, the same refusal. Reads the password store only: no table, no request |

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
- **Event** `approvals.changed`: `{ projectId, campaignId }`, sent to the app window only, through `ApprovalsDeps.changed`, after a command changed what `approvals.forCampaign` returns (the local tables, or the kept password). It carries no email, slug or address. Added to `EventMap` and `EVENT_NAMES` (`src/shared/schemas/events.ts`).
