# Phase 9 — the slices

Slices P9-1 to P9-15. Goal, exit criteria, rules, wave table, design additions and assumptions: `spec/phases/phase-09.md`. Every slice reads that file's "Rules for these slices" and the "Design additions" section it names. "Class" is the verification class (`spec/testing.md`); "Security" is none, short or full.

### P9-1 — Contracts

- **Exists when done:** every Phase 9 command, query and job kind registered against a stub; the shapes, reasons and sentences of "Design additions"; the sign-in secret rule; `storage.dropbox` out of `settings.update`; `canStore()` on the secret store; the Dropbox branch of the key guard; `job.retry` refusing `publish`; the publish ports and their default deps.
- **New files:** `src/shared/schemas/commands/publish.ts` (`publish.run` input and `{ jobId }` reply, `PublishStorageId`); `src/shared/schemas/queries/publish.ts` (`publish.inspect` input, `PublishInspect`); `src/shared/publish/messages.ts` (every Phase 9 refusal reason and sentence of "Design additions", one table); `src/shared/config/public-ids.ts` (`DROPBOX_APP_KEY`, the key on record, D-007); `src/main/publish/ports.ts` (`PublishHeader`, `ExportedFile`, `PublishWarning`, `PublishPorts`); `src/main/publish/deps.ts` (`createPublishDeps`: `exportForPublish` and `warningsForPublish` from `export-adapter.ts`, `storageFor` from `storage-for.ts`); `src/main/publish/export-adapter.ts` (stub: both throw `LocalFailure('export_not_built')`); `src/main/publish/storage-for.ts` (final: `s3` and `dropbox` through `adapterFor`; `fake` only when the fake provider is listed, as `localStorageAt(join(userDataDir, 'fake-storage'))`); `src/main/providers/dropbox/fetch.ts` (stub `defaultDropboxFetch` that throws "not built"). Stubs that refuse `RULE_VIOLATION`, reason `not_built_yet`, "This part of Adman is not built yet.": `src/main/commands/publish/index.ts`, `run.ts`; `src/main/commands/storage/dropbox-sign-in.ts`, `dropbox-sign-out.ts`, `set-dropbox-folder.ts`; `src/main/queries/publish.ts` (refuses the agent already, as `approvals.forCampaign` does); `src/main/jobs/kinds/publish.ts` (throws `LocalFailure('export_not_built')`).
- **May touch:** `src/shared/schemas/commands/storage.ts` (`storageSetDropboxFolderInput`); `src/main/commands/agent-policy.ts` (row `'storage.setDropboxFolder': deny('change the Dropbox folder')`); `src/main/commands/storage/index.ts` (the three Dropbox commands); `src/main/core.ts` (one `publishCommands` spread line, the `publish` deps line, `dropboxFetch: opts.dropboxFetch ?? defaultDropboxFetch`); `src/main/core-deps.ts` (fields `publish`, `dropboxFetch`); `src/main/queries/queries.ts` (`publish.inspect`); `src/main/jobs/kinds/index.ts` (one line); `src/shared/schemas/settings.ts` (patch `storage` holds `s3` only); `src/shared/schemas/secrets.ts` (`SIGN_IN_SECRET_NAMES`, `USER_SECRET_NAMES` without it); `src/main/secrets/secret-store.ts` (`canStore()`; `lastFour: ''` for sign-in secrets); `src/main/providers/require-keys.ts` (the Dropbox branch); `src/shared/schemas/queries/app.ts` (the four job reasons); `src/shared/providers/messages.ts` (their sentences); `src/main/commands/job/retry.ts` (refuse `publish`, `retry_not_offered`); any file whose exhaustive table over a changed union stops compiling (one line each, named in the report).
- **Needs:** Phases 1 to 4 and AP-5 (built). Nothing unbuilt.
- **Read:** `spec/phases/phase-09.md` "Design additions" (all of it); `spec/api-commands.md` "Storage commands"; `spec/mcp-and-agents.md` "Agent policy table"; `spec/infra-and-settings.md` "Secrets", "settings.json"; AP-5 in `spec/phases/approvals-desktop-slices.md` as the model.
- **Tests first:** `tests/unit/shared/schemas/publish-schemas.test.ts` (table: each input good, each refused field, `proceedReason` over 500, `storage` outside the enum); `tests/integration/publish/registration.test.ts` (each new command and `publish.inspect` registered; each stub's refusal reason; `publish.inspect` and every new command refuse the agent; the job kind has a handler); `tests/unit/main/secrets/secret-store-sign-in.test.ts` (`canStore()`; the refresh token's summary has `lastFour: ''`); `tests/integration/commands/secret-sign-in-names.test.ts` (`secret.set` and `secret.delete` with `dropbox.refreshToken` give `INVALID_INPUT`; `settings.update { storage: { dropbox } }` gives `INVALID_INPUT`); `tests/integration/commands/job-retry-publish.test.ts`. Approved edits: `tests/unit/main/commands/agent-policy-table.test.ts` (the row); `tests/integration/providers/require-keys.test.ts` (the Dropbox case: `RULE_VIOLATION`, `dropbox_not_signed_in`, never `NEEDS_KEY`); tests that list command, query, secret or `CoreDeps` names (`tests/integration/registration.test.ts`, `registration-phase2.test.ts`); settings and schema tests that send `storage.dropbox` through `settings.update` (`tests/unit/shared/schemas/phase2-commands.test.ts` if it does).
- **Exit check:** lint, typecheck, `npm test`.
- **Class:** B + A. **Security:** short (policy row, secret names, settings writer, key guard). **Size:** medium (many files, each a few lines).

### P9-2 — Dropbox client core

- **Exists when done:** the pinned fetch, the error mapping, the token calls (code exchange, renewal, revoke, account), the memory-only access token, and the auth half of the Dropbox stand-in.
- **New files:** `src/main/providers/dropbox/hosts.ts` (the two API hosts, the authorize address, `DROPBOX_REDIRECT_URI` built from `DROPBOX_SIGN_IN_PORT`); `pinned-fetch.ts` (`pinnedFetch(inner = fetch)`); `answer.ts` (byte-limited JSON reading); `failure.ts` (the kind table, detail rule, `redactSecret` for both tokens); `oauth.ts` (`exchangeCode`, `renewAccess`, `revokeToken`, `currentAccountName`; each takes the fetch); `access-token.ts` (`accessTokenFor(refreshToken, fetch)`, `forgetDropboxAccess()`); the body of `fetch.ts` (`defaultDropboxFetch = pinnedFetch()`); `tests/helpers/dropbox-stand-in.ts` (Node `http` on `127.0.0.1`: `/oauth2/token` both grants, `/2/auth/token/revoke`, `/2/users/get_current_account`; records requests; can plant a status, an error tag, a slow or oversized answer once; plus `standInFetch(standIn)`, a fetch that keeps the real pin and sends the two Dropbox hosts to the stand-in).
- **May touch:** nothing outside `src/main/providers/dropbox/` and the helper.
- **Needs:** P9-1 (`public-ids.ts`, the `dropbox_signed_out` reason, `fetch.ts`).
- **Read:** `phase-09.md` "Design additions": "Dropbox tokens…", "Dropbox hosts and calls"; `spec/providers.md` (rules every adapter follows, `redactSecret`); `src/main/providers/s3/pinned-host.ts` and `failure.ts` as models.
- **Tests first:** `tests/unit/main/providers/dropbox/pinned-fetch.test.ts` (table: `http:`, another host, `www.dropbox.com`, an IP, a user name in the address, each refused before the inner fetch runs; a redirect refused; the two hosts pass); `failure.test.ts` (one table over every row of the kind list; the detail holds no `error_summary`, no token, at most 200 characters); `oauth.test.ts` (with the stand-in: the exact form fields of each grant, `client_id` sent, no secret field in any request; `invalid_grant` gives `dropbox_signed_out`; a reply missing `refresh_token` or with `token_type` not bearer refused; an oversized answer refused; the account name cleaned: control characters, 150 code points, empty); `access-token.test.ts` (fake clock: reused until 5 minutes before its end; renewed after; two refresh tokens kept apart; forgotten; the token never in a log line or thrown message); `tests/unit/config/no-app-secret.test.ts` (no file under `src/` holds `client_secret` or `app_secret`).
- **Exit check:** lint, typecheck, `npm test`.
- **Class:** E. **Security:** full (outbound calls, tokens). **Size:** medium.

### P9-3 — Dropbox storage

- **Exists when done:** `adapters.storage` in `src/main/providers/dropbox/index.ts` gives a `StorageProvider` that passes the shared conformance cases against the stand-in.
- **New files:** `src/main/providers/dropbox/dropbox-storage.ts` (`dropboxStorage(ctx, { fetch })`: root joining, the five calls, one renewal and one resend after a `401` for a body that can be sent again); `upload.ts` (single call up to 8 MiB, upload session above it and for every stream); `list.ts` (recursive listing, `continue`, files only, the `path_lower` match); the body of `index.ts`; `tests/helpers/dropbox-stand-in-files.ts` (the file routes for the stand-in, in memory, case-insensitive like Dropbox).
- **May touch:** nothing else.
- **Needs:** P9-2.
- **Read:** `spec/storage-and-publish.md` "Storage interface", "Rules for every implementation", "Path rules", "Conformance test"; `phase-09.md` "Dropbox hosts and calls"; `src/main/providers/s3/s3-storage.ts` as the model.
- **Tests first:** `tests/integration/providers/dropbox-conformance.test.ts` (imports the cases of `storage-conformance.ts` unchanged and runs them against the stand-in; with `rootPath` empty and set); `tests/unit/main/providers/dropbox/dropbox-storage.test.ts` (one table, one case per error kind from a planted answer; a `401` renews once and sends again once; a second `401` is `bad_key`; a stream over 8 MiB uses start, append and finish with the right offsets; `exists` false for `path/not_found` and for a folder; remove of a missing file succeeds; no message holds a path; neither token in any failure).
- **Exit check:** lint, typecheck, `npm test`.
- **Class:** E. **Security:** full. **Size:** medium.

### P9-4 — Sign-in listener and PKCE

- **Exists when done:** the PKCE values, the authorize address and the one-use redirect listener, each a function with no Electron and no settings.
- **New files:** `src/main/providers/dropbox/sign-in/pkce.ts` (`makePkce()` → `{ verifier, challenge, state }`, with an injectable byte source for tests); `authorize-url.ts`; `listener.ts` (`waitForRedirect({ port, state, timeoutMs })` → `{ code } | { refused } | { failed }`, with `close()`; `port` given by the caller); `pages.ts` (the fixed pages and their headers).
- **May touch:** nothing else.
- **Needs:** P9-1 (`public-ids.ts`).
- **Read:** `phase-09.md` "The sign-in redirect"; `spec/security.md` "Rules: network requests", "Rules: the MCP door" (the listener rules as a model); `src/main/mcp/request-guard.ts`.
- **Tests first:** `tests/unit/main/providers/dropbox/pkce.test.ts` (lengths and alphabet; the S256 challenge of the RFC 7636 Appendix B example verifier; two calls differ); `authorize-url.test.ts` (the exact query names and values; no secret; `https:` and the one host); `listener.test.ts` (on port 0: bound to `127.0.0.1` only; one table of requests that are answered and ignored: wrong path, `POST`, wrong `Host`, missing `state`, wrong `state`, a code with a bad character, a code of 513 characters; the matching request resolves and closes the listener, and a second connection is refused; `error=access_denied` resolves refused; the time-out; every page has the four headers and none echoes a value from the request; a taken port gives `sign_in_port_busy`).
- **Exit check:** lint, typecheck, `npm test`.
- **Class:** E. **Security:** full (a listener, data from outside). **Size:** medium.

### P9-5 — Sign-in, sign-out and folder commands

- **Exists when done:** `storage.dropboxSignIn`, `storage.dropboxSignOut` and `storage.setDropboxFolder` work as "Design additions" says.
- **New files:** `src/main/providers/dropbox/sign-in/session.ts` (one sign-in at a time; its order: in progress, `canStore()`, listen, `openExternal`, wait, exchange, account, save token, save settings, revoke an old token); the bodies of `src/main/commands/storage/dropbox-sign-in.ts`, `dropbox-sign-out.ts`, `set-dropbox-folder.ts`.
- **May touch:** nothing else.
- **Needs:** P9-2, P9-4.
- **Read:** `phase-09.md` "Dropbox tokens…", "The sign-in redirect"; `spec/api-commands.md` "Storage commands"; `src/main/commands/storage/check-s3.ts` (an app-scope command as model).
- **Tests first:** `tests/integration/commands/dropbox-sign-in.test.ts` (one file, the real port, run alone: `openExternal` is a test function that reads `state` from the address and calls the listener; the token host is the stand-in through `dropboxFetch`; success saves the token and `{ accountName, rootPath }`, keeps an old `rootPath`, returns `{ accountName }` only, sets `changesAppState`; each refusal in its order with nothing saved and `openExternal` not called for the first two; the code, `state`, verifier and tokens appear in no log line, reply or event); `dropbox-sign-out.test.ts` (revoke sent; token deleted; settings null; access token forgotten; offline still signs out); `set-dropbox-folder.test.ts` (saved trimmed; `''` accepted; a table of refused names; refused when not signed in; agent `AGENT_DENIED`).
- **Exit check:** lint, typecheck, `npm test`.
- **Class:** B + E. **Security:** full (redirect handling, token storage). **Size:** medium.

### P9-6 — Dropbox in Settings

- **Exists when done:** the Dropbox part of "Cloud storage" as "Design additions", "Screens" says.
- **New files:** `src/renderer/screens/settings/dropbox-section/` (`dropbox-section.tsx`, `dropbox-folder.tsx`, CSS module, `index.ts`); `tests/shots/p9-6.shots.ts`.
- **May touch:** `src/renderer/screens/settings/s3-section/s3-section.tsx` (mounts `DropboxSection` after the S3 part; a few lines and its comment).
- **Needs:** P9-1 (the commands registered; the tests mock their replies).
- **Read:** `phase-09.md` "Screens"; `spec/screens.md` "Rules for every screen"; `spec/storage-and-publish.md` "Storage settings screen"; `src/renderer/screens/settings/s3-section/` as the model.
- **Tests first:** `tests/unit/renderer/screens/settings/dropbox-section.test.tsx` (signed out: the line and the button; pressing it sends `storage.dropboxSignIn` once, shows the waiting line and disables the button until the reply; signed in from the secret summary and the saved name, drawn as text (a name holding `<b>` shows the tags); "Sign out" sends `storage.dropboxSignOut`; the folder field starts with `rootPath` and "Save folder" sends `storage.setDropboxFolder`; a refusal shows its sentence and keeps the typed text; no input of type password; axe). Shots: `270-settings-dropbox-signed-out`, `271-settings-dropbox-waiting`, `272-settings-dropbox-signed-in` (state planted by test functions; no real sign-in).
- **Exit check:** lint, typecheck, the test, `npm run test:e2e`.
- **Class:** D. **Security:** short (account name as text; no token field). **Size:** small.

### P9-7 — Publish paths and components

- **Exists when done:** every published path is built in one file; the component list of a campaign is collected from the project file with each file checked.
- **New files:** `src/shared/paths/safe-part.ts` (`safePathPart`, see Q-P9-3); `src/shared/publish/paths.ts` (`campaignFolder`, `exportPath`, `componentPath`, `REPORT_HTML`, `REPORT_JSON`, `TRANSLATIONS_CSV`, `MANIFEST`, the campaign ID form); `src/shared/publish/content-types.ts`; `src/main/publish/components.ts` (`collectComponents(handle, { campaignId, variantIds })`); `src/main/publish/component-file.ts` (`checkComponentFile(handle, row)` → `{ absPath, ext } | { problem }`, built from `resolveRow`, `sniffFile`, `fileTypeFor`, without editing `package.ts`).
- **May touch:** nothing else.
- **Needs:** P9-1 (`PublishInspect` component shape).
- **Read:** `spec/storage-and-publish.md` "Published layout", "Path rules"; `phase-09.md` "Publishing" (components), "Project-file values…"; `spec/security.md` "Rules: files and paths"; `spec/data-model-campaign.md` (layer, clip, rule set); `src/main/assets/package.ts` (its file check, as the model).
- **Tests first:** `tests/unit/shared/paths/safe-part.test.ts` and `tests/unit/shared/publish/paths.test.ts` (tables: each refused character, a trailing dot or space, reserved names, empty text, 200 characters cut to 80, letters outside A–Z replaced; every folder's path shape; a campaign ID table of good and refused forms; content type per extension); `tests/integration/publish/components.test.ts` (on a temporary project: background layer and clip go to `backgrounds`, an image layer to `images`, a required asset to `logos` even when it is also a background, a subject's picture to `subjects/{id}`, a font only with its flag (`shareAllowed` false listed, not uploadable), an unused generation attempt and a reference-library asset left out, one asset used twice listed once; hostile rows: a bad subject ID, a non-ULID asset ID, a text row, a renamed file whose bytes do not fit, a missing file, each given its problem and no path outside the row's own).
- **Exit check:** lint, typecheck, `npm test`.
- **Class:** A + B. **Security:** full (project-file values to paths and uploads). **Size:** medium.

### P9-8 — Upload engine

- **Exists when done:** given a storage and a list of files, the engine reads the old manifest, uploads with retries and hashes, writes the manifest and cleans up, only inside the campaign folder.
- **New files:** `src/shared/publish/manifest.ts` (zod schema, `ManifestFile`); `src/main/publish/manifest.ts` (`readPrevious(storage, campaignId)` → `{ publishNumber, projectId, publishedAt } | null`; `writeManifest`); `upload.ts` (`uploadAll(storage, campaignId, files, { open, signal, sleep, onProgress })`, each file `{ path, contentType, open(): ReadableStream }`); `clean-up.ts` (`removeStale(storage, campaignId, keep)`); `tests/helpers/recording-storage.ts` (wraps a `StorageProvider` and records every call's paths).
- **May touch:** nothing else.
- **Needs:** P9-1 (types). The storage interface and local storage are built.
- **Read:** `spec/storage-and-publish.md` "Flow", "Errors"; `phase-09.md` "Publishing" (manifest, clean-up, uploads).
- **Tests first:** `tests/unit/main/publish/upload.test.ts` (with a stand-in storage and a fake `sleep`: waits 1, 4, 10 s, then the failure; `dropbox_signed_out` not retried; each attempt calls `open` again; SHA-256 and size match the bytes; cancel before the next file stops it); `manifest.test.ts` (none gives 1; a good one gives +1 and its `projectId`; a damaged, oversized or wrongly shaped one gives null and a `warn` line with no content); `clean-up.test.ts` (on `localStorageAt` in a temporary folder: deletes only what the manifest lacks; `Exports/A.png` kept when the manifest says `exports/a.png`; `manifest.json` kept; files in `{campaignId}x/` and at the root untouched; the recording wrapper sees no path outside `{campaignId}/`).
- **Exit check:** lint, typecheck, `npm test`.
- **Class:** B. **Security:** full (deletes in the user's storage). **Size:** medium.

### P9-9 — `publish.inspect`

- **Exists when done:** the query answers as "Design additions" says.
- **New files:** `src/main/publish/readiness.ts` (`storageReadiness(deps)`, using `requireS3Settings`, `requireProviderKeys` and the sign-in check without throwing to the window); `src/main/publish/inspect.ts`; the body of `src/main/queries/publish.ts`.
- **May touch:** nothing else.
- **Needs:** P9-7, P9-8.
- **Read:** `phase-09.md` "Publishing" (`publish.inspect`); `spec/api-queries-events.md` (query rules); `src/main/queries/approvals.ts` (a user-only query).
- **Tests first:** `tests/integration/publish/inspect.test.ts` (with `storageFor` giving local storage on a temporary folder: each readiness value per storage; `fake` only when listed; `existing` null for `storage: null`; files counted, number and time from a planted manifest, `otherProject` from another project's ID; components with local paths and problems; a failing storage gives `PROVIDER_ERROR` with the fixed sentence and no detail; unknown campaign `NOT_FOUND`; the agent refused before anything is read; no key in any reply).
- **Exit check:** lint, typecheck, `npm test`.
- **Class:** B. **Security:** full (a network call; paths to the window). **Size:** small.

### P9-10 — `publish.run` and the publish job

- **Exists when done:** `publish.run` refuses and starts as "Design additions" says; the job publishes through the ports, with the fake exporter in tests.
- **New files:** `src/main/publish/work-folder.ts`; `src/main/publish/run-publish.ts`; the bodies of `src/main/commands/publish/run.ts` and `src/main/jobs/kinds/publish.ts`; `tests/helpers/fake-publish-export.ts` (a port that writes two small ads, `report-x.html`, `report-x.json` and a sheet into the work folder and records the header it was given).
- **May touch:** nothing else.
- **Needs:** P9-9 (readiness), P9-7, P9-8.
- **Read:** `phase-09.md` "Publishing" (all), "The export interface"; `spec/jobs.md` (runner, background kinds, cancel); `src/main/jobs/run-job.ts` (why `jc.call` is not used).
- **Tests first:** `tests/integration/publish/campaign-folder-isolation.test.ts` (the named test: local storage in a temporary folder holding another campaign's folder, a `{campaignId}x/` folder and a root file; two publishes; the recording wrapper sees every list, write and remove under `{campaignId}/`; the other files byte for byte unchanged; stale files of the first publish gone after the second); `tests/integration/publish/publish-run.test.ts` (each refusal in its order with no job row; `replace_not_confirmed` only when files exist; `publish_has_warnings` carries the list; success makes one `publish` job and replies `{ jobId }`; the agent `AGENT_DENIED`); `tests/integration/publish/publish-job.test.ts` (the layout of "Published layout" with the fake exporter; the header given to the export has the next number; the manifest's files, sizes and hashes; `paid_calls` stays 0; a skipped component in the result; an upload failure leaves the old manifest and no clean-up; cancel before the manifest leaves the old one; the work folder gone after success, failure and cancel; a link in place of `publish-work` gives `work_folder_unsafe`; `export_not_built` with the stub port); `tests/unit/main/publish/work-folder.test.ts` (leftover ULID folders removed, a link or a file of the same name left alone).
- **Exit check:** lint, typecheck, `npm test`.
- **Class:** B. **Security:** full (writes and deletes in the user's storage, a local folder made and removed). **Size:** large; if it nears the budget, hand off after `publish.run` and its tests, leaving the job body.

### P9-11 — Export wiring

- **Exists when done:** `exportForPublish` and `warningsForPublish` call Phase 8's export and checks and Phase 6's sheet, so a publish carries real ads, the report with its publish header, and `translations.csv`.
- **New files:** the body of `src/main/publish/export-adapter.ts`.
- **May touch:** nothing else. If Phase 8 or Phase 6 code must change to fit "The export interface", stop and report; the architect rules.
- **Needs:** P9-10; Phase 8's in-job export function and checks list; Phase 6's translation sheet.
- **Read:** `phase-09.md` "The export interface"; `spec/export-and-checks.md` "Export", "Report", "Translation sheet"; Phase 8's plan for the names it built.
- **Tests first:** `tests/integration/publish/export-adapter.test.ts` (with the fake image provider: a campaign of two image variants gives two ads with the right `relPath`, both report files with the header "publish 2" when given 2, the sheet when the campaign has a second language and none when not; warnings map to `PublishWarning`; a failed export ends `export_failed` and nothing is uploaded).
- **Exit check:** lint, typecheck, `npm test`, and the reference-picture tests if the export's drawing is touched (it should not be).
- **Class:** B + C. **Security:** short. **Size:** small.

### P9-12 — Publish dialog

- **Exists when done:** the dialog's first view as "Design additions", "Screens" says: storage choice, the replace block, the prompt line, the file list, the fonts, Publish, and the started view.
- **New files:** `src/renderer/dialogs/publish-dialog/` (`publish-dialog.tsx`, `storage-choice.tsx`, `replace-warning.tsx`, `use-publish-inspect.ts`, CSS module, `index.ts`); `src/renderer/ui/publish-file-list/`; `src/renderer/ui/font-share-choice/`; `tests/shots/p9-12.shots.ts`.
- **May touch:** nothing else (the button that opens it is P9-13).
- **Needs:** P9-1 (query and command registered; tests mock the replies).
- **Read:** `phase-09.md` "Screens"; `spec/screens.md` "Rules for every screen"; `src/renderer/ui/dialog-frame/` and `src/renderer/dialogs/package-dialog/` as models.
- **Tests first:** `tests/unit/renderer/dialogs/publish-dialog.test.tsx` (inspect with `storage: null` on open; not-ready choices disabled with their lines; choosing a storage inspects again and shows "Looking…"; nothing published; the replace block with both lines, the other-project line and the checkbox, Publish disabled until ticked; the prompt line always; Publish sends `publish.run` once with `replaceConfirmed`, disabled while waiting; a refusal's sentence shown and the dialog stays; the started view; Cancel and Escape send nothing; axe); `tests/unit/renderer/ui/publish-file-list.test.tsx` (by folder; path and name as text, `<b>` in a name drawn as text; problem marks); `font-share-choice.test.tsx` (ticking sends `asset.update { fontPublishAllowed: true }` then the list is read again; a refusal shown). Shots: `273-publish-dialog-first`, `274-publish-dialog-replace`, `275-publish-dialog-fonts`, `276-publish-dialog-not-set-up`.
- **Exit check:** lint, typecheck, the tests, `npm run test:e2e`.
- **Class:** D. **Security:** short (local paths drawn; nothing sent but the two calls). **Size:** medium.

### P9-13 — Warnings step and the Publish button

- **Exists when done:** the dialog's warnings step; "Publish…" on the campaign page; no Retry on publish rows.
- **New files:** `src/renderer/dialogs/publish-dialog/publish-warnings.tsx` (and its use in `publish-dialog.tsx`, a file of P9-12, merged before); `src/renderer/screens/campaign/publish-button/`; `tests/shots/p9-13.shots.ts`.
- **May touch:** `src/renderer/screens/campaign/campaign-view/campaign-view.tsx` (mounts `PublishButton` in the header; a few lines); `src/renderer/app/activity-row/row-retry.tsx` (`retryShown` false for `publish`; one line); `src/renderer/dialogs/publish-dialog/publish-dialog.tsx`.
- **Needs:** P9-12.
- **Read:** `phase-09.md` "Screens"; `spec/screens-campaign.md` "The campaign grid and the variant tile" (the header); `spec/screens-ai.md` "The activity panel".
- **Tests first:** `tests/unit/renderer/dialogs/publish-warnings.test.tsx` (the list as text; the reason field capped at 500; "Publish anyway" sends `publish.run` with `proceedDespiteWarnings: true` and the reason; "Back" sends nothing; axe); `tests/unit/renderer/screens/campaign/publish-button.test.tsx` (opens the dialog for this campaign); approved addition to the `row-retry` test: no Retry for a failed publish row. Shots: `277-publish-warnings`, `278-campaign-publish-button`.
- **Exit check:** lint, typecheck, the tests, `npm run test:e2e`.
- **Class:** D. **Security:** none. **Size:** small.

### P9-14 — Remove the hand-test tools

- **Exists when done:** what "Removing the hand-test tools" in the old outline named is gone: the hand-test screen, `dev.storage`, `{userData}/hand-test-local` handling, the four `HAND_TEST_*` constants. `requireS3Settings` stays. The `devTools` flag stays.
- **Delete:** `src/renderer/dev/` (all of it); `src/main/commands/dev/storage.ts`, `hand-test-storage.ts`, `local-root.ts`, `storage-error.ts`; `src/shared/config/dev-tools.ts`; `src/shared/schemas/commands/dev.ts`; the tests that cover only these (`tests/unit/renderer/dev/`, `tests/unit/main/commands/dev/`, `tests/integration/commands/dev-storage*.test.ts`, `dev-fixture.ts`).
- **May touch:** `src/main/commands/dev/index.ts` (returns `[]`, comment says so; `core.ts` is not edited); `src/main/commands/agent-policy.ts` (remove the `dev.storage` row; leave `dev.comfyExtend`); `src/renderer/app/app-shell/app-shell.tsx` (no "Hand test" button or view); `src/renderer/stores/app-store.ts` (no `handTest` view); `tests/unit/main/commands/agent-policy-table.test.ts`; `tests/integration/registration-phase2.test.ts`, `tests/unit/shared/schemas/phase2-commands.test.ts`; `tests/e2e/screen-tour.ts`, `screen-tour.spec.ts`, `launch.ts`, `workflow-5-1.spec.ts` (lines about the hand-test screen only); `tests/unit/live/live-output.test.ts` and `tests/unit/e2e-real/real-env.test.ts` only if they import a removed file.
- **Needs:** P9-6 and P9-12 merged.
- **Read:** the old outline's list (now in this file's "Exists when done"); `spec/security.md` "Hand-test tools"; Q-P9-5.
- **Tests first:** `tests/unit/config/no-hand-test.test.ts` (no file under `src/` or `tests/` names `HAND_TEST_`, `hand-test-local`, `dev.storage` or `renderer/dev/`, this test excepted); the shell test: no "Hand test" button with dev tools on.
- **Exit check:** lint, typecheck, `npm test`, `npm run build`, `npm run test:e2e`.
- **Class:** B + D. **Security:** short (a named security test removed, Q-P9-5). **Size:** small to medium (many deletions).

### P9-15 — End to end, shots, exit check

- **Exists when done:** the phase's exit criteria hold; the stakeholder's checks are written down.
- **New files:** `tests/e2e/publish.spec.ts` (fake providers on: the example campaign, open the dialog, choose "Fake provider", the file list shows, Publish, the activity list shows the publish done; files under `{userData}/fake-storage/{campaignId}/` in the documented layout with `manifest.json`; publish again: the replace block, tick, publish; the second manifest says 2; a file planted in the campaign folder is gone and one planted beside it is not); `tests/live/dropbox.live.test.ts` (the stakeholder's: with `DROPBOX_ACCESS_TOKEN`, upload, list and remove one file under `adman-live-test/`; skips without the token; never run by an agent); `tests/shots/p9-15.shots.ts` (`279-publish-running`, `280-publish-done`).
- **May touch:** `tests/live/env-file.ts` (`DROPBOX_ACCESS_TOKEN` read; `LIVE_REDACTED_NAMES` gains `DROPBOX_ACCESS_TOKEN` and `DROPBOX_APP_SECRET`) and its test; `src/main/providers/dropbox/dropbox-storage.ts` only to accept a fixed access token for the live test, if P9-3 did not.
- **Needs:** every other P9 slice (P9-11 for real ads in the e2e run).
- **Read:** `phase-09.md` "Exit criteria"; `spec/test-harnesses.md`; `spec/testing.md` "Test commands".
- **Tests first:** the e2e spec above; `tests/unit/live/env-file.test.ts` addition (the two names redacted).
- **Exit check:** the whole of "Exit criteria" in `phase-09.md` except the stakeholder's part; the report lists the stakeholder's checks word for word.
- **Class:** G (end to end) + A. **Security:** short (live-test redaction). **Size:** medium.
