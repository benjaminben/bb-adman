# Phase 9 — slices P9-9 to P9-15

Publishing, the dialog, clean-up of the hand-test tools and the end-to-end proof. Goal, exit criteria, rules, wave table, design additions and assumptions: `spec/phases/phase-09.md`. Slices P9-1 to P9-8: `spec/phases/phase-09-slices.md`. "Class" is the verification class (`spec/testing.md`); "Security" is none, short or full.

### P9-9 — `publish.inspect` (built)

- **Exists when done:** the query answers as "Design additions" says.
- **New files:** `src/main/publish/readiness.ts` (`storageReadiness(deps)`, using `requireS3Settings`, `requireProviderKeys` and the sign-in check without throwing to the window); `src/main/publish/inspect.ts`; the body of `src/main/queries/publish.ts`; `src/main/publish/font-consent.ts` (the local consent list, A-260); `src/main/commands/publish/set-font-consent.ts` (`publish.setFontConsent`).
- **Font consent** (A-260, security class full): `publish.inspect` reports each font's `share` as `confirmed`, `needs_confirming` (the project flag is set but this machine holds no consent for this hash) or `not_shared`; the flag alone never gives `confirmed`. `publish.setFontConsent` writes the local list; agents are denied it.
- **May touch:** `src/shared/schemas/queries/publish.ts` (`share` replaces `shareAllowed`); `src/shared/schemas/commands/publish.ts` (the `publish.setFontConsent` input); `src/main/commands/publish/index.ts` (register it); `src/main/commands/agent-policy.ts` (row `'publish.setFontConsent': deny('share a font')`) and the policy table test; `src/main/publish/components.ts` (pass the flag as a hint only); `src/shared/publish/paths.ts` (the short ID is the last 8 characters of the asset ID, from the P9-7 review) and its test. Nothing else.
- **Needs:** P9-7, P9-8.
- **Read:** `phase-09.md` "Publishing" (`publish.inspect`), "Font sharing consent is local"; `spec/api-queries-events.md` (query rules); `src/main/queries/approvals.ts` (a user-only query).
- **Tests first:** `tests/integration/publish/inspect.test.ts` (with `storageFor` giving local storage on a temporary folder: each readiness value per storage; `fake` only when listed; `existing` null for `storage: null`; files counted, number and time from a planted manifest, `otherProject` from another project's ID; components with local paths and problems; a failing storage gives `PROVIDER_ERROR` with the fixed sentence and no detail; unknown campaign `NOT_FOUND`; the agent refused before anything is read; no key in any reply); `tests/integration/publish/font-consent.test.ts` (a project flag of 1 with no local consent gives `needs_confirming`; after `publish.setFontConsent` it gives `confirmed`; a changed font file gives `needs_confirming` again; another project ID or asset ID with the same bytes is not confirmed; a damaged consent file counts as empty; the agent `AGENT_DENIED`).
- **Exit check:** lint, typecheck, `npm test`.
- **Class:** B. **Security:** full (a network call; paths to the window; the consent list). **Size:** medium.

### P9-10 — `publish.run` and the publish job (built)

- **Exists when done:** `publish.run` refuses and starts as "Design additions" says; the job publishes through the ports, with the fake exporter in tests.
- **New files:** `src/main/publish/work-folder.ts`; `src/main/publish/run-publish.ts`; the bodies of `src/main/commands/publish/run.ts` and `src/main/jobs/kinds/publish.ts`; `tests/helpers/fake-publish-export.ts` (a port that writes two small ads, `report-x.html`, `report-x.json` and a sheet into the work folder and records the header it was given).
- **Required hardening** (from the P9-7 and P9-8 reviews):
  - `src/main/publish/open-inside.ts` refuses a hard link (`nlink !== 1`), and a root that is a link or whose real path differs from it (as `src/main/export/target.ts` does), reusing `pathInside` from `src/main/assets/path-resolver.ts`. The root is chosen per component file.
  - Every failure (a storage failure's detail, `LocalFileRefused`, "Storage path refused") is mapped to a fixed reason before the job row is written; no storage error text reaches the row.
  - `campaignPrefix` in `src/main/publish/manifest.ts` checks the campaign ID form (from `paths.ts`).
  - A remote path ending `.partial` is refused. Every relative path, including `exportPath` and `componentPath`, is wrapped in `campaignPath`; settle whether `ExportedFile.relPath` already starts with `exports/` and test it.
  - Duplicate remote paths, compared in lower case, end the job before any upload (`publish_paths_clash`).
  - Each component file is checked again just before its upload; an MP4 or MOV component must also pass `videoFileFacts`.
  - Fonts: uploaded only when `hasConsent(...) === true` for the SHA-256 of the bytes about to be sent (A-260); otherwise skipped as `not_shared`. Never upload a font on "anything but false".
  - Order: upload, then manifest, then clean-up; no clean-up after a failure; the old manifest's `projectId` read again before clean-up.
- **May touch:** `src/main/publish/open-inside.ts`, `manifest.ts` (`campaignPrefix`) and their tests; `PROVIDER_ERROR_REASONS` in `src/shared/schemas/queries/app.ts` and `src/shared/providers/messages.ts` (one reason, `publish_paths_clash`). Nothing else.
- **Needs:** P9-9 (readiness, font consent), P9-7, P9-8.
- **Read:** `phase-09.md` "Publishing" (all), "The export interface"; `spec/jobs.md` (runner, background kinds, cancel); `src/main/jobs/run-job.ts` (why `jc.call` is not used).
- **Tests first:** `tests/integration/publish/campaign-folder-isolation.test.ts` (the named test: local storage in a temporary folder holding another campaign's folder, a `{campaignId}x/` folder and a root file; two publishes; the recording wrapper sees every list, write and remove under `{campaignId}/`; the other files byte for byte unchanged; stale files of the first publish gone after the second); `tests/integration/publish/publish-run.test.ts` (each refusal in its order with no job row; `replace_not_confirmed` only when files exist; `publish_has_warnings` carries the list; success makes one `publish` job and replies `{ jobId }`; the agent `AGENT_DENIED`); `tests/integration/publish/publish-job.test.ts` (the layout of "Published layout" with the fake exporter; the header given to the export has the next number; the manifest's files, sizes and hashes; `paid_calls` stays 0; a skipped component in the result; an upload failure leaves the old manifest and no clean-up; cancel before the manifest leaves the old one; the work folder gone after success, failure and cancel; a link in place of `publish-work` gives `work_folder_unsafe`; `export_not_built` with the stub port; a font with the project flag and no local consent not uploaded; a font consented then changed not uploaded; two components whose paths differ only in letter case end `publish_paths_clash` with nothing uploaded; a hard-linked component and a linked root refused; no storage error text in the job row); `tests/unit/main/publish/work-folder.test.ts` (leftover ULID folders removed, a link or a file of the same name left alone).
- **Exit check:** lint, typecheck, `npm test`.
- **Class:** B. **Security:** full (writes and deletes in the user's storage, a local folder made and removed). **Size:** large; if it nears the budget, hand off after `publish.run` and its tests, leaving the job body.

### P9-11 — Export wiring (built)

- **Exists when done:** `exportForPublish` and `warningsForPublish` call Phase 8's export and checks and Phase 6's sheet, so a publish carries real ads, the report with its publish header, and `translations.csv`.
- **As built** (rulings at build time): Phase 8's export has no publish-header option; the adapter writes the header at the top of the two report files after Phase 8 has written them. A publish is all or nothing about its ads: if any ad fails to export, the job ends `export_failed` before any upload, so the earlier published copy of that ad stays. A publish inserts no `report` row (no local path is stored) and is not counted as a local export. Its four review lows went to P9-13.
- **New files:** the body of `src/main/publish/export-adapter.ts`.
- **May touch:** nothing else. If Phase 8 or Phase 6 code must change to fit "The export interface", stop and report; the architect rules.
- **Needs:** P9-10; Phase 8's in-job export function and checks list; Phase 6's translation sheet.
- **Read:** `phase-09.md` "The export interface"; `spec/export-and-checks.md` "Export", "Report", "Translation sheet"; Phase 8's plan for the names it built.
- **Tests first:** `tests/integration/publish/export-adapter.test.ts` (with the fake image provider: a campaign of two image variants gives two ads with the right `relPath`, both report files with the header "publish 2" when given 2, the sheet when the campaign has a second language and none when not; warnings map to `PublishWarning`; a failed export ends `export_failed` and nothing is uploaded).
- **Exit check:** lint, typecheck, `npm test`, and the reference-picture tests if the export's drawing is touched (it should not be).
- **Class:** B + C. **Security:** short. **Size:** small.

### P9-12 — Publish dialog (built)

- **As built:** each font's full local path is shown under its tick; names are cleaned and drawn in `<bdi>`; the replace tick and the answer are cleared when inspect is read again; `publish.inspect` gives each font's `sha256`, the dialog sends it back, and `publish.setFontConsent` with `allowed: true` needs it and refuses when the file's fresh hash differs.

- **Exists when done:** the dialog's first view as "Design additions", "Screens" says: storage choice, the replace block, the prompt line, the file list, the fonts, Publish, and the started view.
- **New files:** `src/renderer/dialogs/publish-dialog/` (`publish-dialog.tsx`, `storage-choice.tsx`, `replace-warning.tsx`, `use-publish-inspect.ts`, CSS module, `index.ts`); `src/renderer/ui/publish-file-list/`; `src/renderer/ui/font-share-choice/`; `tests/shots/p9-12.shots.ts`.
- **May touch:** nothing else (the button that opens it is P9-13).
- **Needs:** P9-1 (query and command registered; tests mock the replies); P9-9 (the `share` field and `publish.setFontConsent`).
- **Read:** `phase-09.md` "Screens"; `spec/screens.md` "Rules for every screen"; `src/renderer/ui/dialog-frame/` and `src/renderer/dialogs/package-dialog/` as models.
- **Tests first:** `tests/unit/renderer/dialogs/publish-dialog.test.tsx` (inspect with `storage: null` on open; not-ready choices disabled with their lines; choosing a storage inspects again and shows "Looking…"; nothing published; the replace block with both lines, the other-project line and the checkbox, Publish disabled until ticked; the prompt line always; Publish sends `publish.run` once with `replaceConfirmed`, disabled while waiting; a refusal's sentence shown and the dialog stays; the started view; Cancel and Escape send nothing; axe); `tests/unit/renderer/ui/publish-file-list.test.tsx` (by folder; path and name as text, `<b>` in a name drawn as text; problem marks); `font-share-choice.test.tsx` (a font with `share: 'needs_confirming'` starts unticked with the confirm line, never ticked from the project flag; ticking sends `publish.setFontConsent { allowed: true }`, then `asset.update { fontPublishAllowed: true }`, then the list is read again; unticking sends `allowed: false`; a refusal shown). The tick writes the local consent only through `publish.setFontConsent`, which agents are denied (A-260). Shots: `273-publish-dialog-first`, `274-publish-dialog-replace`, `275-publish-dialog-fonts`, `276-publish-dialog-not-set-up`.
- **Exit check:** lint, typecheck, the tests, `npm run test:e2e`.
- **Class:** D. **Security:** short (local paths drawn; nothing sent but the three calls). **Size:** medium.

### P9-13 — Warnings step and the Publish button (built)

- **Exists when done:** the dialog's warnings step; "Publish…" on the campaign page; no Retry on publish rows.
- **New files:** `src/renderer/dialogs/publish-dialog/publish-warnings.tsx` (and its use in `publish-dialog.tsx`, a file of P9-12, merged before); `src/renderer/screens/campaign/publish-button/`; `tests/shots/p9-13.shots.ts`.
- **May touch:** `src/renderer/screens/campaign/campaign-view/campaign-view.tsx` (mounts `PublishButton` in the header; a few lines); `src/renderer/app/activity-row/row-retry.tsx` (`retryShown` false for `publish`; one line); `src/renderer/dialogs/publish-dialog/publish-dialog.tsx`.
- **Needs:** P9-12.
- **Read:** `phase-09.md` "Screens"; `spec/screens-campaign.md` "The campaign grid and the variant tile" (the header); `spec/screens-ai.md` "The activity panel".
- **Tests first:** `tests/unit/renderer/dialogs/publish-warnings.test.tsx` (the list as text; the reason field capped at 500; "Publish anyway" sends `publish.run` with `proceedDespiteWarnings: true` and the reason; "Back" sends nothing; axe); `tests/unit/renderer/screens/campaign/publish-button.test.tsx` (opens the dialog for this campaign); approved addition to the `row-retry` test: no Retry for a failed publish row. Shots: `277-publish-warnings`, `278-campaign-publish-button`.
- **Exit check:** lint, typecheck, the tests, `npm run test:e2e`.
- **Class:** D. **Security:** none. **Size:** small.

### P9-14 — Remove the hand-test tools (built)

- **As built:** `src/main/commands/dev/index.ts` returns `[]`; the `dev.storage` policy row is gone and `dev.comfyExtend`'s stays; the named test `dev-storage-confinement.test.ts` is replaced, as Q-P9-5 says, by campaign folder isolation and the publish work-folder test. A local-storage test was added back: links inside a folder are left out of its listing.

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
