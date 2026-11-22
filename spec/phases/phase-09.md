# Phase 9 — Cloud publishing

**Goal:** A campaign's deliverables and components in S3 or Dropbox [REQ: FR-160 to FR-164, FR-241, R-15].

**Where things are.** This file: goal, exit criteria, rules, the order of the slices, the lists, the design additions, assumptions A-210 to A-229 and the open questions. The slices P9-1 to P9-8: `spec/phases/phase-09-slices.md`; P9-9 to P9-15: `spec/phases/phase-09-slices-2.md`. Design: `spec/storage-and-publish.md` (storage interface, S3, Dropbox, publishing), `spec/security.md`, `spec/infra-and-settings.md` ("Secrets", "settings.json"), `spec/screens.md`, `spec/testing.md`. Where this file's "Design additions" and the topic files differ, this file wins until the orchestrator folds it in.

**Already built and reused, not rebuilt:** the storage interface and path rules (`src/main/providers/types.ts`, `storage-paths.ts`), local storage, the S3 adapter with its host pin, the S3 part of Settings (`src/renderer/screens/settings/s3-section/`), `storage.checkS3` with "Test connection" (`src/main/commands/storage/check-s3.ts`, `require-s3-settings.ts`, `src/main/providers/s3/check-access.ts`), the storage conformance cases, `DROPBOX_SIGN_IN_PORT` (`src/main/providers/dropbox/sign-in-port.ts`), the Dropbox input schemas (`src/shared/schemas/commands/storage.ts`), the policy rows `publish.run`, `storage.dropboxSignIn`, `storage.dropboxSignOut`, the `publish` job kind in the kind list, the `asset.font_publish_allowed` column and `asset.update { fontPublishAllowed }`, the `dropbox` npm package (10.66.0).

## Exit criteria

- On `main`: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:build` and `npm run test:e2e` pass. `npm test` includes the named tests of this phase: campaign folder isolation (`tests/integration/publish/campaign-folder-isolation.test.ts`), the storage conformance cases against the Dropbox stand-in, the sign-in listener tests and the policy table test.
- `tests/e2e/publish.spec.ts` passes: the built app publishes a made-up campaign to the fake storage (`{userData}/fake-storage`), shows the replace warning on the second publish, and the second manifest says publish 2.
- The hand-test screen, `dev.storage`, `{userData}/hand-test-local` handling and the four `HAND_TEST_*` constants are gone; a search of `src/` and `tests/` finds none of them.
- Shots 270 to 280 made and named in the slice reports.
- No agent signed in to Dropbox, opened the Dropbox sign-in page, contacted the real Dropbox or a real bucket, or ran `npm run test:live`.

**Left for the stakeholder** (each after merge, with his own accounts; none blocks the merge):

- **OI-18 hand proof, Dropbox.** Sign in to Dropbox from Settings: the browser opens Dropbox's page, and after approval Settings shows "Signed in as {name}". Publish a campaign to Dropbox: the layout of `spec/storage-and-publish.md`, "Published layout", appears under `Apps/{app folder}/{root folder}/{campaignId}/`, with `manifest.json`. Delete one variant, publish again: the dialog shows the replace warning, the report header says publish 2, and the deleted variant's files are gone. Sign out: Settings shows "Not signed in", and the app is no longer listed under the Dropbox account's connected apps.
- **Hand publish, S3.** The same publish, re-publish and clean-up with his own bucket.
- **Live Dropbox test.** `npm run test:live -- tests/live/dropbox.live.test.ts` with his short-lived token in `.env.local` (one file uploaded, listed, removed).
- **Windows** (D-087): the Dropbox sign-in and one publish.

## Dependencies

- Phases 1 to 4 and approvals' AP-5, AP-7, AP-10a, AP-10b (built). Nothing else for P9-1 to P9-10 and P9-12 to P9-14.
- **P9-11 needs Phase 8 and Phase 6** through the interface named in "Design additions", "The export interface". It is the only slice that calls export code. P9-15 needs P9-11.
- OI-18 is done (D-090, D-091); only the hand proof above waits for the stakeholder.

## Rules for these slices

- Write the failing tests first, then the code; run what the slice's class asks (`spec/testing.md`). A slice that touches `src/renderer/` also runs `npm run test:e2e`. Prefer one table test over many alike cases.
- A slice edits only its new files and the existing files it "May touch". A change needed elsewhere: stop and report.
- **Shared files.** Only P9-1 edits `agent-policy.ts`, `core.ts`, `core-deps.ts`, `queries/queries.ts`, `jobs/kinds/index.ts`, `settings.ts`, `secrets.ts`, `secret-store.ts`, `require-keys.ts`, `PROVIDER_ERROR_REASONS` in `src/shared/schemas/queries/app.ts`, `src/shared/providers/messages.ts`, `commands/job/retry.ts` and `commands/storage/index.ts`. Exceptions: P9-14 removes the `dev.storage` row from `agent-policy.ts`; P9-9 adds the `publish.setFontConsent` row to `agent-policy.ts` and registers that command in `commands/publish/index.ts` (A-260); P9-10 adds the job reason `publish_paths_clash` to `PROVIDER_ERROR_REASONS` and `messages.ts`. P9-1 registers every command, query and job kind of the phase against a stub; the slice that owns a stub replaces its body and touches no index.
- **No migration.** Phase 9 adds no table or column (migration number 0009 is not used).
- **Nothing leaves this machine** (D-086). No agent opens the Dropbox sign-in page, signs in to Dropbox, sends a request to a Dropbox host, an Amazon host or any real bucket, or runs `npm run test:live`. Every Dropbox call in a test goes through the pinned fetch into a stand-in on `127.0.0.1` (`tests/helpers/dropbox-stand-in.ts`); every S3 call through a stand-in request handler under the real host pin, as AP-10b did. `openExternal` is a test function in every test; it never opens a browser.
- **No paid call.** Nothing in this phase calls a paid provider. Storage calls never go through `jc.call`, so they add no paid count.
- **Secrets.** No Dropbox token, code, `state` value or code verifier goes into a log line, an event, a job row, a reply, a test name or test output. The app secret is never read, stored, sent or shipped; no file under `src/` holds the words `client_secret` or `app_secret` (a test checks it, P9-2). The one exception is `src/main/providers/firefly/token.ts`, another provider's sign-in, which the test names.
- **Screens** (D-084): one folder per component, CSS from the existing tokens only (`src/renderer/ui/tokens.css`); no slice adds a token. Each screen slice adds `tests/shots/p9-{n}.shots.ts`; shot names start with the slice's numbers from 270 to 289.
- **Security class.** "Full" slices merge only after a full security review, "short" after a short one.
- Budget: one slice per developer run, well under 300k tokens; hand off with `HANDOFF.md` if near it.

## Order and side-by-side work

| Wave | Slice | Needs | May run beside | Must not run beside |
|------|-------|-------|----------------|---------------------|
| 1 | P9-1 Contracts | Nothing unbuilt | Any slice of another phase that edits none of its shared files | Another phase's contracts slice (`core.ts`, `core-deps.ts`, `agent-policy.ts`, `queries.ts`, `jobs/kinds/index.ts`, `queries/app.ts`, `providers/messages.ts`, `settings.ts`); any slice editing `secrets.ts`, `secret-store.ts`, `require-keys.ts` or `job/retry.ts` |
| 2 | P9-2 Dropbox client core | P9-1 | P9-4, P9-6, P9-7, P9-8, P9-12 | Nothing |
| 2 | P9-4 Sign-in listener and PKCE | P9-1 | P9-2, P9-6, P9-7, P9-8, P9-12 | Nothing |
| 2 | P9-6 Dropbox in Settings | P9-1 | Every wave 2 slice | Any slice editing `s3-section/` (none planned) |
| 2 | P9-7 Publish paths and components | P9-1 | Every wave 2 slice | A Phase 8 slice creating `src/shared/paths/safe-part.ts` (open question Q-P9-3) |
| 2 | P9-8 Upload engine | P9-1 | Every wave 2 slice | Nothing |
| 2 | P9-12 Publish dialog | P9-1 | Every wave 2 slice | Nothing |
| 3 | P9-3 Dropbox storage | P9-2 | P9-5, P9-9, P9-13 | Nothing |
| 3 | P9-5 Sign-in, sign-out, folder commands | P9-2, P9-4 | P9-3, P9-9, P9-13 | Nothing |
| 3 | P9-9 `publish.inspect` | P9-7, P9-8 | P9-3, P9-5, P9-13 | Nothing |
| 3 | P9-13 Warnings step and Publish button | P9-12 | P9-3, P9-5, P9-9 | AP-11, AP-12, Phase 5 or Phase 8 slices editing `campaign-view.tsx`; a Phase 8 slice editing `row-retry.tsx` |
| 4 | P9-10 `publish.run` and the publish job | P9-9 | P9-14 | Nothing |
| 4 | P9-14 Remove the hand-test tools | P9-6, P9-12 | P9-10 | Any slice editing `app-shell.tsx`, `app-store.ts`, `agent-policy.ts`, `tests/e2e/screen-tour*` or `tests/e2e/launch.ts` |
| 5 | P9-11 Export wiring | P9-10; Phase 8's export function and checks; Phase 6's translation sheet | Any slice not editing `src/main/publish/export-adapter.ts` | Nothing |
| 6 | P9-15 End to end, shots, exit check | Every other P9 slice | Other phases' slices | Any slice editing `tests/live/env-file.ts` |

Ten of the fifteen slices can run before any other phase lands: after P9-1, wave 2 is six slices with no file in common.

## Can start now

Needs only what Phases 1 to 4 (and the built approvals slices) made:

- **P9-1** at once.
- After P9-1, with nothing from Phases 5 to 8: P9-2, P9-3, P9-4, P9-5, P9-6, P9-7, P9-8, P9-9, P9-10, P9-12, P9-13, P9-14.
- Only **P9-11** and **P9-15** wait for Phase 8 (and Phase 6, for the translation sheet).

## Shared files

Existing files that more than one P9 slice, or another phase, is likely to edit:

| File | P9 slices | Others likely |
|------|-----------|---------------|
| `src/main/commands/agent-policy.ts` and `tests/unit/main/commands/agent-policy-table.test.ts` | P9-1, P9-14 | Every phase's contracts slice |
| `src/main/core.ts`, `src/main/core-deps.ts` | P9-1 | Phase 5 to 8 contracts slices |
| `src/main/queries/queries.ts` | P9-1 | Phase 6, 8 contracts |
| `src/main/jobs/kinds/index.ts` | P9-1 | Phase 6 (translation), Phase 5 (generative fill), Phase 8 (export) |
| `src/shared/schemas/queries/app.ts` (`PROVIDER_ERROR_REASONS`), `src/shared/providers/messages.ts` | P9-1 | Phases 6 to 8 |
| `src/shared/schemas/settings.ts`, `src/main/settings/defaults.ts` | P9-1 | Phase 8 (reports name) |
| `src/shared/schemas/secrets.ts`, `src/main/secrets/secret-store.ts`, `src/main/providers/require-keys.ts` | P9-1 | None known |
| `src/main/commands/job/retry.ts` | P9-1 | Phase 5, 7 (new retry kinds) |
| `src/renderer/screens/campaign/campaign-view/campaign-view.tsx` | P9-13 | AP-11, AP-12, Phase 5, Phase 8 (Export button) |
| `src/renderer/app/activity-row/row-retry.tsx` | P9-13 | Phase 8 (export rows) |
| `src/renderer/app/app-shell/app-shell.tsx`, `src/renderer/stores/app-store.ts` | P9-14 | Phase 10 (agent panels) |
| `tests/e2e/screen-tour.ts`, `screen-tour.spec.ts`, `launch.ts`, `workflow-5-1.spec.ts` | P9-14 | Any phase adding screens to the tour |
| `tests/integration/registration.test.ts`, `registration-phase2.test.ts` | P9-1, P9-14 | Every contracts slice |
| `tests/live/env-file.ts` and its test | P9-15 | None known |
| `src/shared/paths/safe-part.ts` (new, see Q-P9-3) | P9-7 | Phase 8 (`output-paths.ts`) |

## Design additions

Rules the topic files do not yet hold. The orchestrator folds each into the topic file named.

### Dropbox tokens and the "missing token" ruling (`storage-and-publish.md`, `security.md`, `infra-and-settings.md`)

- `dropbox.refreshToken` is a **sign-in secret**: `SIGN_IN_SECRET_NAMES = ['dropbox.refreshToken']` in `src/shared/schemas/secrets.ts`, left out of `USER_SECRET_NAMES`. So `secret.set` and `secret.delete` refuse it (`INVALID_INPUT`). Only `storage.dropboxSignIn` writes it and only `storage.dropboxSignOut` deletes it, both through the secret store in the main process. Its summary carries `lastFour: ''`: the window learns only that it exists [A-211].
- **Missing token.** `requireProviderKeys(deps, 'dropbox', purpose)` refuses with `RULE_VIOLATION`, reason `dropbox_not_signed_in`, "Sign in to Dropbox in Settings, then try again.", never `NEEDS_KEY`. So the key dialog never opens for Dropbox; the window sends the user to Settings [A-212]. This answers the outline's "how the window tells a missing token from a missing key".
- **The access token** lives only in main-process memory (`access-token.ts`), keyed by a SHA-256 of the refresh token, renewed 5 minutes before it ends and after a `401`, forgotten at sign-out. It is never written to disk [A-210].
- **Settings.** `storage.dropbox` leaves the `settings.update` patch schema. `accountName` is written only by `storage.dropboxSignIn`; `rootPath` only by the new command `storage.setDropboxFolder { rootPath }` (app-scope, `deny`, "change the Dropbox folder"; sets `changesAppState`). `rootPath` is trimmed, at most 200 characters, may be `''`, and every part must pass the storage path rules (a refusal is `INVALID_INPUT`, "That folder name cannot be used in Dropbox."). Refused while not signed in (`dropbox_not_signed_in`) [A-213]. **Signed in** means the refresh token is saved; a missing `accountName` then shows "your Dropbox account".

### Dropbox hosts and calls (`storage-and-publish.md`, "Dropbox"; `security.md`, network requests)

- **Pinned fetch** (`src/main/providers/dropbox/pinned-fetch.ts`): `https:` only, host exactly `api.dropboxapi.com` or `content.dropboxapi.com`, `redirect: 'error'`, no credentials from the environment. Any other address is refused before a socket opens. Every answer body is read with a byte limit: 1 MiB for JSON, the file itself for `read`. The browser alone goes to `https://www.dropbox.com/oauth2/authorize`, through `openExternal`.
- **Calls** (HTTP API v2, over the pinned fetch, recommendation Q-P9-1): token `POST /oauth2/token` (grants `authorization_code` with `code_verifier`, and `refresh_token`, each with `client_id` and no secret); `POST /2/auth/token/revoke`; `POST /2/users/get_current_account`; `files/get_metadata` (exists; `path/not_found` and a folder give false); `files/download` (read); `files/upload` for bytes up to 8 MiB, else `files/upload_session/start`, `append_v2` in 8 MiB parts, `finish` (write, mode `overwrite`, `mute: true`); `files/list_folder` with `recursive: true` and `list_folder/continue` (files only; `path/not_found` gives an empty list); `files/delete_v2` one path at a time, `path_lookup/not_found` counted as removed [A-217].
- **Paths.** Every path is `/{rootPath}/{path}` (or `/{path}` with an empty `rootPath`), inside the app folder. `list` matches the prefix on `path_lower` and returns `path_display` with the root cut off.
- **Error kinds.** `401` after one renewal, `invalid_access_token`, `403`, `missing_scope`: `bad_key`. Token grant answering `invalid_grant`: `bad_key`, reason `dropbox_signed_out`. `429`, `too_many_requests`, `too_many_write_operations`, `503`: `quota`. A marked timeout: `timeout`. Another marked network error: `offline`. Everything else: `other`. The detail is the status and the error's `.tag` chain only (for example `409 path/insufficient_space`), at most 200 characters, through `redactSecret` for the refresh and access tokens. Never `error_summary`, which can hold a path.

### The sign-in redirect (`storage-and-publish.md`, `security.md`) — security class full

- **Before anything opens:** refuse `sign_in_in_progress` if a sign-in waits; refuse with the secret store's "This computer cannot store keys securely." if secure storage is not available (`canStore()`, added in P9-1).
- **PKCE.** Code verifier: 64 random bytes, base64url (86 characters). Challenge: SHA-256, base64url, method `S256`. `state`: 32 random bytes, base64url. All from `crypto.randomBytes`.
- **Listener** on `127.0.0.1:DROPBOX_SIGN_IN_PORT`, opened before the browser; if the port is taken the sign-in refuses `sign_in_port_busy` and no browser opens. The server is `unref()`ed and closes on success, refusal, or after 5 minutes (`sign_in_timed_out`).
  - Answers only `GET /oauth/dropbox` with `Host` exactly `127.0.0.1:{port}`, where `{port}` is the port the listener is bound to (in the app, the constant `DROPBOX_SIGN_IN_PORT`, so `127.0.0.1:47822`). Anything else: `404`, fixed text, keeps waiting.
  - `state` compared with `timingSafeEqual`. Missing or wrong: `400`, fixed page "This sign-in is not the one Adman is waiting for.", keeps waiting [A-214].
  - Matching `state` with `error`: ends `sign_in_refused`. With `code` (1 to 512 characters of `A–Z a–z 0–9 - _ . ~`): the listener closes at once (one use only), then the code is exchanged. Matching `state` with neither: ends `sign_in_failed`.
  - Every page: fixed HTML "You can close this tab and go back to Adman." (or the refusal line), `Content-Type: text/html; charset=utf-8`, `Content-Security-Policy: default-src 'none'`, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`. No value from the request is echoed.
- **Authorize address:** `https://www.dropbox.com/oauth2/authorize` with `client_id` (the app key on record in `src/shared/config/public-ids.ts`), `response_type=code`, `redirect_uri=http://127.0.0.1:47822/oauth/dropbox`, `state`, `code_challenge`, `code_challenge_method=S256`, `token_access_type=offline`, `scope=files.content.write files.content.read files.metadata.read`.
- **After the code:** exchange (`token_type` bearer, `refresh_token` 1 to 1,000 characters, `access_token`, `expires_in` a number; otherwise `sign_in_failed`), then `get_current_account`. `accountName` is `name.display_name` with control and format characters removed, trimmed, at most 100 code points, else `''`. The email and account ID are not kept [A-216]. Then the refresh token is saved, then `settings.storage.dropbox = { accountName, rootPath }` (the old `rootPath` kept, else `''`). A sign-in over an existing one revokes the old token after the new one is saved, best effort. If the settings write fails, the old token is put back in its own `try`; a failure there is logged by error name only, and the settings failure is the one reported.
- **Sign-out:** revoke at Dropbox (best effort; a failure is logged by kind only), delete the token, forget the access token, `settings.storage.dropbox = null`. Works offline [A-215].
- **Refusals** (`RULE_VIOLATION` unless named, `details.reason`): `sign_in_in_progress` "A Dropbox sign-in is already waiting for the browser." (a sign-in during a sign-out keeps this reason with "Adman is signing out of Dropbox. Try again when that has finished."); `sign_out_in_progress` "Adman is already signing out of Dropbox." (a second sign-out while one runs); `sign_in_port_busy` "Adman could not wait for Dropbox's answer: another program is using port {port}. Close it and try again."; `sign_in_timed_out` "The Dropbox sign-in took too long. Try again."; `sign_in_refused` "The Dropbox sign-in was cancelled."; `sign_in_failed` (`PROVIDER_ERROR`) "Dropbox did not finish the sign-in. Try again."

### Publishing (`storage-and-publish.md`, "Publishing"; `api-commands.md`; `api-queries-events.md`)

- **`publish.inspect { projectId, campaignId, storage: 's3' | 'dropbox' | 'fake' | null }`** — user only; an agent gets "Agents cannot read publish details in this version. Ask the user to do it in the app." Reply:

  ```ts
  type PublishStorageId = 's3' | 'dropbox' | 'fake'
  type PublishReady = 'ready' | 'not_set_up' | 'needs_key' | 'not_signed_in'
  type PublishInspect = {
    storages: Array<{ id: PublishStorageId; label: string; ready: PublishReady }> // fake only when listed
    existing: null | { files: number; publishNumber: number | null; publishedAt: string | null; otherProject: boolean }
    components: Array<{ assetId: string; displayName: string; kind: 'image' | 'video' | 'font'
      folder: 'backgrounds' | 'logos' | 'subjects' | 'images' | 'fonts'; localPath: string
      problem: 'missing' | 'wrong_type' | null
      share: 'confirmed' | 'needs_confirming' | 'not_shared' | null }> // fonts only (A-260); P9-9 replaces P9-1's shareAllowed
  }
  ```

  `existing` is null when `storage` is null or not ready; otherwise it lists `{campaignId}/` and reads `manifest.json` (at most 8 MiB). A storage failure is `PROVIDER_ERROR` with "Adman could not look at the published folder." plus the kind's sentence. Unknown campaign: `NOT_FOUND`.
- **`publish.run { projectId, campaignId, storage, replaceConfirmed, proceedDespiteWarnings, proceedReason? }`** (`proceedReason` at most 500 characters). Refusals in order: unknown campaign `NOT_FOUND`; campaign ID not of the campaign ID form `campaign_id_unsafe` "This campaign's ID cannot be used as a folder name." [A-221]; `fake` not listed `INVALID_INPUT`; S3 `storage_not_set_up`, then `NEEDS_KEY`; Dropbox `dropbox_not_signed_in`; a `publish` job of this campaign queued or running `publish_running` "This campaign is being published. Wait until it ends." [A-226]; files under `{campaignId}/` and `replaceConfirmed` false `replace_not_confirmed` "This campaign already has published files. Confirm that they will be replaced."; warnings and `proceedDespiteWarnings` false `publish_has_warnings` "Some ads have warnings. Fix them or publish anyway.", `details: { reason, warnings: Array<{ variantId, title, message }> }` [A-225]. Then one `publish` job (provider = storage ID) and the reply `{ jobId }`.
- **The job** (`jobs/kinds/publish.ts`, body in `src/main/publish/run-publish.ts`): (0) the work folder; (1) read the old manifest: publish number = its number + 1, else 1 [A-220]; (2) the export port into the work folder with the publish header `{ publishedAt, publishNumber }` (progress 0 to 0.5); (3) collect components of the exported variants; (4) upload every file (0.5 to 0.95), then `manifest.json`; (5) clean-up (to 1). Result `{ publishNumber, uploaded, removed, skipped: Array<{ assetId, problem }> }` (`problem` also `not_shared`, A-260). Order is upload, then manifest, then clean-up; after any upload failure there is no manifest and no clean-up. Cancel is checked before each file; the manifest is never written after a cancel or a failure, so the old one stays. The work folder is removed in every case.
- **Manifest** (`src/shared/publish/manifest.ts`): `{ format: 1, appVersion, projectId, campaignId, publishNumber, publishedAt, files: Array<{ path, bytes, sha256 }> }`, paths relative to `{campaignId}/`, `manifest.json` itself not listed. Read with a zod schema; anything else counts as no manifest (logged `warn`, reason `manifest_unreadable`, no content).
- **Clean-up:** list `{campaignId}/`, delete each path not in the new manifest, comparing with letter case folded, never `manifest.json` [A-219]. Every path the job lists, writes or deletes starts with `{campaignId}/` (named test).
- **Uploads:** each file opened fresh for each attempt; SHA-256 counted while streaming; up to 3 more attempts after waits of 1, 4 and 10 s, for every failure except reason `dropbox_signed_out` [A-224]. Content types from `src/shared/publish/content-types.ts` (`png`, `jpg`, `webp`, `mp4`, `mov`, `webm`, `ttf`, `otf`, `woff2`, `html` with UTF-8, `json`, `csv` with UTF-8).
- **Components** [A-222, A-223]: every asset a layer (`source.assetId`, `style.fontAssetId`) or background clip of an exported variant uses, in the asset library. One folder each, first match: `logos` (in the rule set's `required_asset_ids`), `subjects/{subjectId}` (attached to a subject; `subjectId` must be a ULID, else the asset goes on down the list), `fonts` (kind `font`; uploaded only with local consent, A-260), `backgrounds` (used by a background layer or a clip), `images`. Name `{safePathPart(displayName)}-{assetId8}.{ext}`, where `assetId8` is the **last** 8 characters of the asset ID (the random part of the ULID; the first characters are its time and repeat), `ext` from the file-type table for the bytes' type, never from the file name. If any two files of a publish (ads, reports, components) have remote paths that match when compared in lower case, the job ends before any upload with reason `publish_paths_clash`, "Two files would have the same name in the published folder. Nothing was published." (P9-10 adds the reason and sentence). Before upload: regular file, extension listed for the kind, first bytes fit, and for MP4 and MOV `videoFileFacts` gives facts; else `problem` and skipped. The check runs again just before each component's upload.
- **Work folder** `{userData}/publish-work/{jobId}/` [A-227]: `{userData}/publish-work` checked with `lstat` (a link or a non-folder refuses `work_folder_unsafe`), the job folder made new; removed at the end. At a publish start, leftover direct children whose names are ULIDs and are real folders (not links) are removed.
- **No retry** of a publish job: `job.retry` refuses kind `publish` (`RULE_VIOLATION`, `retry_not_offered`, "Publish again from the campaign."), and the activity list shows no Retry for it [A-226].
- **Job reasons and sentences** (`PROVIDER_ERROR_REASONS`, `messages.ts`): `dropbox_signed_out` "Dropbox no longer accepts Adman's sign-in. Sign in again in Settings."; `export_not_built` "Publishing needs export, which this version does not have yet."; `export_failed` "The export for this publish failed. Nothing was replaced."; `work_folder_unsafe` "Adman's work folder for publishing is not safe to use. Nothing was published."

### Font sharing consent is local [A-260] — assumption, for the owner's review

A project file can come from someone else, so its `asset.font_publish_allowed` flag alone never lets a font be uploaded. Consent counts only if it was given on this machine. Security class full.

- **The local list:** `{userData}/font-consent.json`, `{ format: 1, keys: string[] }`, at most 10,000 keys, each `{projectId}:{assetId}:{sha256}` (both IDs ULIDs, the hash 64 lower-case hex digits). Not in the project file. Read with a zod schema and a 1 MiB limit; a damaged, oversized or wrongly shaped file counts as empty (`warn`, no content). Written through `{name}.partial` and a rename. Module: `src/main/publish/font-consent.ts` (`hasConsent(projectId, assetId, sha256)`, `setConsent(...)`).
- **The hash** is the SHA-256 of the font file's bytes, measured by the app from the checked file (`checkComponentFile`), never read from `asset.content_hash`.
- **The command** `publish.setFontConsent { projectId, assetId, allowed: boolean }`: user only, agent policy `deny` ("share a font"). It checks the row is a font component of the project, hashes the file, and adds or removes the key. A changed file therefore needs a new tick.
- **`publish.inspect`** gives each font `share`: `'confirmed'` when the list holds its key; `'needs_confirming'` when the project flag is true but the list does not; `'not_shared'` otherwise.
- **The upload:** `run-publish.ts` hashes each font just before its upload and uploads it only when `hasConsent(...) === true` for that hash (never "anything but false"). A font without it is left out and named in `skipped` with problem `not_shared`.
- **The dialog** never pre-ticks a box from the project flag; it asks again (Screens, below).

### The export interface (asked of Phase 8 and Phase 6)

P9-1 writes the port types in `src/main/publish/ports.ts`; P9-11 adapts the real code to them (built, `src/main/publish/export-adapter.ts`). As built:

- **Phase 8's `runExport`** runs **inside the publish job** (not as a job of its own), into `outputRoot`, the work folder, which must be a real folder at its own real path. It is given a job context that makes no provider call and whose `report.add` saves nothing. Phase 8 has no publish-header option: the adapter writes the header `{ publishedAt, publishNumber }` at the top of the two report files after Phase 8 has written them [REQ: FR-241]. The port returns the files written, each `{ role, relPath, absPath }` (`relPath` relative to the campaign folder, without `exports/`), and the exported variant IDs.
- **All or nothing about its ads** (ruled at P9-11): if any ad fails to export, the export ends `export_failed` before the report is written, so nothing is uploaded or cleaned up and the earlier published copy of that ad stays.
- **No `report` row** (ruled at P9-11): a publish stores no local path and is not counted as a local export.
- **From Phase 8, the checks** for a campaign as a list of warnings `{ variantId, title, message }`, without exporting.
- **From Phase 6**, the translation sheet's bytes for a campaign (`translation.exportSheet`'s content), or none.
- The port, as P9 uses it: `exportForPublish(deps, input) → { files: ExportedFile[]; variantIds: string[] }` with roles `ad`, `report_html`, `report_json`, `translations_csv`; `warningsForPublish(deps, { projectId, campaignId }) → PublishWarning[]`. Until P9-11 both stubs throw `LocalFailure('export_not_built')`.

### Project-file values that reach a path or a request (`security.md` table, new rows)

| Value | Where it goes | File | Check before use |
|---|---|---|---|
| Campaign `id` | The published folder | `src/shared/publish/paths.ts` | The campaign ID form (`^[a-z0-9-]{1,40}-[a-z0-9]{6}$`, or `campaign-{6}`) and the storage path rules |
| Asset `rel_path`, `abs_path`, `kind` | Which file publish uploads | `src/main/publish/component-file.ts` | Linked or managed path resolved as `resolveRow` does; regular file; extension listed for the kind; first bytes fit; text never |
| Asset `display_name`, `id` | The component file name | `paths.ts` | `safePathPart`, cut to 80 characters; `id` a ULID |
| Asset `subject_id` | `subjects/{subjectId}` | `components.ts` | ULID, else not a subject folder |

### Screens (`screens.md`)

- **Dropbox in Settings** (under "Amazon S3" in "Cloud storage"): heading "Dropbox"; line "Adman keeps published files in its own folder in your Dropbox, under Apps." Not signed in: "Not signed in." and "Sign in to Dropbox". Waiting: the button disabled, "Waiting for you to finish in the browser…". Signed in: "Signed in as {accountName}." (text), "Sign out", the field "Folder" (accessible name "Folder in the app folder", placeholder "App folder"), saved on Enter or when the field is left, then "Saved" (SET-6); an empty field means the app folder itself. A refusal shows its sentence (`role="alert"`). No field for a token anywhere.
- **Publish dialog** (`dialogs/publish-dialog/`, a `DialogFrame kind="publish"`, DLG-6b), title "Publish {campaign name}". Nothing is sent but `publish.inspect` until the user presses "Publish". In order:
  - **"To"** (`storage-choice.tsx`): one radio per storage `publish.inspect` lists, drawn as segments and named by its label, each with a mark: a check (tip "Set up") or "Not set" (tip "Set up Amazon S3 in Settings.", "Add your Amazon S3 keys in Settings." or "Sign in to Dropbox in Settings."). A storage that is not set up can be chosen, but nothing is read or sent for it: "Publish" stays disabled, and a quiet "Settings" button shows, which closes the dialog and opens the Publish settings page.
  - "Looking at the published folder…" while it reads.
  - **What is there** (`replace-warning.tsx`): nothing published yet gives the mark "First publish" (tip "Nothing is published for this campaign yet."). Files there give a warn notice "Replaces publish {n} · {date}" ("Replaces the published files" when the number or date is not known), with an InfoTip "This will replace the files published for this campaign. Someone may be reviewing the files that will be replaced." [REQ: FR-241]; when `otherProject`, a visible mark "From another project" (tip "These files were published from another project with the same campaign ID."); and the Switch "Replace" (named "Replace the published files"), off at every read of the folder. Only the user's own switch lets "Publish" replace files.
  - The short line "Files carry their prompts." with an InfoTip holding the full sentence "Generated images and videos carry the prompt that made them. Anyone with these files can read it.", which is also the dialog's accessible description.
  - **"Files that will be uploaded"** (`ui/publish-file-list/`, `PublishFileList { projectId, components }`), a region with one list "Files", in the published folders' order (logos, subjects, fonts, backgrounds, images): an ObjectRow per file with its thumbnail (through the asset address, which holds only the project and asset IDs; an icon for a video or font), its display name and its kind ("Picture", "Video", "Font"). **Under each row, the file's full local path as plain text** [REQ: R-06, 8.4; A-218]: a project file from someone else can point an asset at any file on this computer, so the path is the user's check of what will leave it. The path is in no tooltip, accessible name or attribute. A problem keeps a visible mark: "File not found" (tip "File not found, will be skipped"), "Not usable" (tip "Not a usable file, will be skipped"), or for a font without consent "Not uploaded" (tip "Will not be uploaded"). With none: "No pictures, videos or fonts are used."
  - **"Fonts"** (`ui/font-share-choice/`), one group per font: its name, its full local path as text, and the tick "I am allowed to share this font", described by the path, never ticked from the project file's flag (A-260): ticking sends `publish.setFontConsent`, then `asset.update { fontPublishAllowed }` as a hint, then inspect again; a font whose `share` is `needs_confirming` adds the line "This project file says the font may be shared. Confirm it on this computer." [A-229].
  - **"Also uploaded"**: chips "Ads", "Report", "Sheet", "List" (tips: the exported ads, the report, the translation sheet, a list of the files).
  - Foot: "Cancel" and "Publish" (enabled when the storage is set up, inspect has answered, and "Replace" is on if files exist). A refusal shows its sentence and the first view stays.
  - On `publish_has_warnings`: the warnings as text, the field "Why publish anyway? (optional)" (its placeholder and name; 500 characters), "Back" (reads `publish.inspect` again) and "Publish anyway" (disabled for 500 ms after the step opens, `ARM_DELAY_MS` in `use-armed.ts`, so a double click cannot confirm).
  - After the start: a bar "Publishing" (`JobProgress`) with "Run in background", which only closes the dialog (the job goes on in Activity); the hidden status "Publishing has started. You can close this window and follow it in the activity list." When the job ends, one mark ("Done", "Failed" or "Cancelled") and "Close".
- **Campaign page:** "Publish…" in the campaign head (the head's one primary) opens the dialog.

## Assumptions

Each is a judgement call made to keep the build moving; the orchestrator adds them to `spec/assumptions.md`.

| ID | Assumption | Undo cost |
|----|-----------|-----------|
| A-210 | The Dropbox access token is kept in memory only, never on disk; only the refresh token is in `secrets.bin` | Low |
| A-211 | `dropbox.refreshToken` is a sign-in secret: not settable or deletable with `secret.set`/`secret.delete`; its summary shows no characters | Low |
| A-212 | A missing Dropbox token is `RULE_VIOLATION` `dropbox_not_signed_in` from the one key guard, never `NEEDS_KEY`; the window points to Settings | Low |
| A-213 | `storage.dropbox` leaves `settings.update`; `storage.setDropboxFolder` (deny) writes `rootPath`; only sign-in writes `accountName` | Low |
| A-214 | A wrong `state`, path or `Host` at the listener is answered and ignored; the sign-in keeps waiting | Low |
| A-215 | Sign-out revokes the token at Dropbox, best effort, then deletes it locally | Low |
| A-216 | Only the display name is kept from the Dropbox account, cleaned and cut to 100 code points | Low |
| A-217 | The Dropbox adapter calls the HTTP API over a pinned fetch, not through the SDK; removal is one `delete_v2` per file | Medium (Q-P9-1) |
| A-218 | The publish dialog draws the components' full local paths, an exception to "the renderer draws no file path"; `publish.inspect` is user only | Low |
| A-219 | Clean-up compares paths with letter case folded and never deletes `manifest.json` | Low |
| A-220 | The publish number is the old manifest's number + 1, else 1; the manifest records `projectId`, and inspect flags files from another project | Low |
| A-221 | A campaign ID not of the campaign ID form never names a folder (`campaign_id_unsafe`) | Low |
| A-222 | Component folder order: logos, subjects, fonts, backgrounds, images; each asset once; extension from the bytes' type | Low |
| A-223 | A component whose file is missing or unfit is skipped, listed beforehand and named in the job result; the publish goes on | Low |
| A-224 | Every upload failure is retried (1, 4, 10 s) except `dropbox_signed_out`; each attempt reopens the file | Low |
| A-225 | Checks run before the job: `publish.run` refuses `publish_has_warnings` with the list unless told to proceed, with an optional reason | Medium (Phase 8 may shape it) |
| A-226 | One publish per campaign at a time; publish jobs are not retried from the activity list | Low |
| A-227 | The export for a publish goes to `{userData}/publish-work/{jobId}/`, removed afterwards; leftovers are removed at the next publish | Low |
| A-228 | With fake providers on, the fake provider offers storage: local storage at `{userData}/fake-storage/`, for end-to-end tests | Low (Q-P9-2) |
| A-229 | The font sharing choice is in the publish dialog's font list, not the editor's font field; after a publish starts the dialog points to the activity list | Low |
| A-260 | Font sharing consent counts only if given on this machine: a local list in app data keyed by project ID, asset ID and file hash; the project-file flag is a hint (assumption, for the owner's review; numbered past Phase 11's range because A-210 to A-229 are full) | Medium |

## Open questions

The plan proceeds on each recommendation.

- **Q-P9-1. The Dropbox SDK or the plain HTTP API?** The spec names the `dropbox` SDK. It needs about ten calls, and pinning hosts and pointing tests at a stand-in is simplest with one fetch the app owns. **Recommendation:** plain HTTP over the pinned fetch (A-217); leave the package installed for Phase 11's dependency review to drop.
- **Q-P9-2. A fake storage for end-to-end tests.** `spec/storage-and-publish.md` says "There is no fake storage", and the outline's exit criterion says "against a fake storage". Without one, the built app cannot publish in `test:e2e`. **Recommendation:** the fake provider's storage is `localStorageAt({userData}/fake-storage)`, offered only when the fake provider is listed (A-228). The named isolation test still runs on local storage in a temporary folder.
- **Q-P9-3. One owner for the safe-name rule.** Phase 8's `postTitle` and Phase 9's component names use the same rule (characters outside `A–Z a–z 0–9 + - _ space` become `-`, then the path rules). **Recommendation:** `safePathPart` lives in `src/shared/paths/safe-part.ts`, made by whichever of P9-7 and the Phase 8 path slice is built first; the other imports it. The orchestrator tells the Phase 8 architect.
- **Q-P9-4. The export interface.** Phase 8 is being sliced at the same time. **Recommendation:** Phase 8 provides the in-job export function and the checks list exactly as "The export interface" says, and Phase 6 the sheet bytes; any difference is absorbed in `export-adapter.ts` (P9-11) only.
- **Q-P9-5. A named security test goes away.** `tests/integration/commands/dev-storage-confinement.test.ts` is in `spec/security.md`'s named tests; it tests `dev.storage`, which P9-14 removes. **Recommendation:** remove it with the command; campaign folder isolation and the work-folder test take its place in the table.
- **Q-P9-6. "Test connection" for Dropbox.** Not in the design. **Recommendation:** not in this phase; the sign-in proves the token, and the first publish proves the folder.

## Found in the existing design

- **`dropbox.refreshToken` can be typed today.** It is in `USER_SECRET_NAMES`, so `secret.set` accepts it, against the rule "a refresh token is never typed"; its summary also gives its last four characters. P9-1 fixes both.
- **`settings.update` can write `storage.dropbox`,** account name included. P9-1 removes it from the patch schema.
- **A storage call through `jc.call` would count as a paid call** (S3 and Dropbox are not `local`). The publish job never uses `jc.call`.
- **Retry for a failed publish** would show the paid confirm and resend the old request without the replace check; P9-1 and P9-13 remove it.
- **The renderer path rule** ("draws no file path") conflicts with R-06's "full local paths" in the publish dialog; A-218 makes the exception.
- **`spec/api-principles.md`** says Dropbox is "not set up" with no root folder; an empty root folder is valid. Dropbox's not-set-up state is "not signed in".
- **`spec/api-commands.md`'s `publish.run` input** lacks the proceed fields, which the checks flow needs.
- **The outline's `HAND_TEST_DROPBOX = true` step** is dropped: the hand-test screen is removed in this phase.
- **`dev.comfyExtend`** has a policy row but no command (CU-8 did not build it). P9-14 leaves the row; it belongs to the ComfyUI hand-test work (OI-64).
- **The Dropbox live test** in `spec/storage-and-publish.md` stays the stakeholder's: no agent runs `test:live`.
