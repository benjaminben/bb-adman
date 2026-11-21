# Approvals by link

**Goal:** A user can make a password-protected link for a campaign, reviewers can sign off on its variants from a browser with an email address, and the sign-offs show in the app [D-095]. Built beside Phase 4 and the look pack without holding either back (the stakeholder's words: "This feature should be built in parallel to not block the phases ahead").

**Exit criteria**

- The service's own checks pass on this machine: in `approvals-service/`, `npm run typecheck` and `npm test`; at the root, `npm run lint`.
- The app's checks pass: lint, typecheck, `npm test` (with `migration-0004.test.ts` and the contract test), build, `test:build`, `npm run test:e2e` (with `tests/e2e/approvals.spec.ts` against the stand-in service).
- `npm run test:approvals-local` passes once (AP-13): the real Worker code under `wrangler dev` on `127.0.0.1`, the built app beside it, and a real browser as the visitor. The flow: set up the service in Settings, make a link, update the gallery, open the link, a wrong password, the right one, sign off; the app shows "Signed off by 1"; edit the variant; the app shows "Changed since sign-off"; update the gallery; the sign-off shows "for an earlier version" in the gallery and in the app; turn the link off; the link shows the password page and nothing else.
- Shots 90 to 99 made and named in the reports.
- `approvals-service/README.md` holds the deploy steps and the list of values the stakeholder supplies, with no value written in.
- No agent has deployed anything, signed in to Cloudflare, run a `--remote` command, or contacted a deployed service (D-086).

**Dependencies:** Phase 3 merged; P4-10 merged before AP-5 (it edits `core.ts`); P4-12 merged before AP-11 (it edits `campaign-view/`). The service slices need nothing from the app.

**Design:** `spec/approvals.md` (desktop side, security rules and threats, assumptions A-82 to A-100) and `spec/approvals-service.md` (the service). Questions for the stakeholder: OI-94 to OI-97 in `spec/open-items.md`.

## Rules for these slices

- Every slice: write the failing tests first, then the code; run what its class asks. A slice that touches the renderer runs `npm run test:e2e` too. Prefer one table test over many near-identical cases.
- **Class S (the service):** root `npm run lint`; in `approvals-service/`, `npm run typecheck` and `npm test`. Other classes as in `spec/testing.md`.
- A slice edits only the files it owns and the existing files it may touch. A change needed elsewhere: stop and report.
- **Service slices touch only `approvals-service/`.** AP-1 also adds the root ignore lines, the app's copy of the contract and the two root contract tests. So AP-1 to AP-4 may run beside any Phase 4 or look-pack slice.
- **The contract.** Only AP-1 writes `src/shared/approvals/contract.ts` and its copy. A later slice that finds it must change stops and reports; the architect rules, and the change goes into both copies in one commit.
- **Nothing leaves this machine** (D-086). No `wrangler login`, `wrangler deploy`, `wrangler secret put`, `wrangler d1 create`, and no command with `--remote`. No test contacts a deployed service or a real S3 bucket. Every script that runs `wrangler` sets `WRANGLER_SEND_METRICS=false`. Installing packages with npm is allowed. If `wrangler dev` asks to sign in, stop and report.
- **No paid call and no real S3.** S3 code is tested with stand-ins and by signing on this machine (signing sends nothing). The stakeholder's own check with a real bucket comes after deploying.
- **One migration.** Only AP-5 runs `npm run db:generate` (`0004_approvals`). If a Phase 4 or look-pack slice needs a migration before AP-5 merges, both stop and the orchestrator orders them.
- **Shared files.** Only AP-5 edits `agent-policy.ts`, `events.ts`, `queries/queries.ts`, the Drizzle schema index, `settings.ts`, `secrets.ts`, `core-deps.ts`, and the `core.ts` spread and deps lines. AP-5 registers every approvals command and query against a stub file; the slice that owns the stub replaces its body and touches no index. `src/main/approvals/deps.ts` (AP-5) imports `createPasswordStore` from `password-store.ts` and `choosePictureStore` from `picture-store.ts`, both stubs from AP-5, so AP-6 and AP-7 never edit the same file.
- **Screens** (D-084): one folder per component, CSS from the existing tokens only. No slice here adds a token, so none edits `tokens.css`. A screen slice's edit to an existing component is a mount point of a few lines, named in the slice. Each screen slice adds `tests/shots/ap-{n}.shots.ts` (for example `tests/shots/ap-10.shots.ts`); picture names start with the numbers given in the slice, from the range 90 to 99 kept for this feature.
- **Security class.** Slices marked "full" merge only after a full security review; "short" after a short one.
- Budget: one slice per developer run, well under 300k tokens; hand off with `HANDOFF.md` if near it.

## Order and side-by-side work

| Wave | Slice | Waits for | May run beside | Must not run beside |
|------|-------|-----------|----------------|---------------------|
| 1 | AP-1 Service skeleton, contract, database | Nothing (startable now) | Every Phase 4 and look-pack slice | Nothing |
| 2 | AP-2 Service: link API | AP-1 | AP-3, AP-5, every Phase 4 and look-pack slice | Nothing |
| 2 | AP-3 Service: visitor pages and sessions | AP-1 | AP-2, AP-5, every Phase 4 and look-pack slice | Nothing |
| 2 | AP-5 Desktop contracts | AP-1; P4-10 merged | AP-2, AP-3, AP-4, the look pack, Phase 4 screen slices | P4-10 (`core.ts`); any slice that adds a migration or edits `agent-policy.ts`, `events.ts`, `queries.ts`, `settings.ts` or `secrets.ts` (none is planned in Phase 4 or the look pack) |
| 3 | AP-4 Service: sign-offs and pictures | AP-2, AP-3 | Everything | Nothing |
| 3 | AP-6 Service client, service settings, kept passwords | AP-5 | AP-4, AP-7 | Nothing |
| 3 | AP-7 Pictures: signed addresses and the picture store | AP-5 | AP-4, AP-6 | Any slice that edits `package.json`, `src/main/providers/types.ts` or `src/main/providers/s3/` (none is planned) |
| 4 | AP-8 Link commands and the queries | AP-6, AP-7 | AP-10 | Nothing |
| 4 | AP-10 Settings: approvals service and S3 | AP-6 | AP-8, AP-9 | Nothing (`settings-screen.tsx` has no other planned editor) |
| 5 | AP-9 Update gallery and refresh | AP-8 | AP-10 | Nothing |
| 6 | AP-11 Approval dialog, bar and store | AP-9; P4-12 merged | AP-10 | P4-12 and AP-12 (`campaign-view/`) |
| 7 | AP-12 Tile marks | AP-11 | Phase 4 and look-pack slices | P4-12 and AP-11 (`campaign-view/`); any slice editing `variant-tile/` or `variant-grid/` (none is planned) |
| 8 | AP-13 Local end-to-end proof, deploy steps, exit check | Every other AP slice | Phase 4 and look-pack slices | Nothing |

No two slices of one wave edit the same file: wave 2 splits by folder (`approvals-service/src/api/`, `approvals-service/src/visitor/`, and the app); wave 3 by folder (the service's `visitor/` and `pictures/`, the app's client and password store, the app's picture store and S3 adapter); wave 4 by main process against Settings screens.

## Slices

### AP-1 — Service skeleton, contract, database

- **Exists when done:** `approvals-service/` installs, type-checks and tests on this machine; `wrangler.jsonc`, the D1 migration and its data-access functions exist; the router registers every route of `spec/approvals-service.md` against stub handlers (an API stub answers `404 not_found`, a visitor stub `404` "Not found."), and `GET /api/v1/health` works with the full key check; the contract exists in both places with the copy test; the password hash and the random letters work.
- **New files:** `approvals-service/package.json`, `tsconfig.json`, `wrangler.jsonc`, `vitest.config.ts`, `migrations/0001_init.sql`; `src/index.ts`, `app.ts`, `env.ts`, `contract.ts`; `src/api/auth.ts`, `body.ts`, `errors.ts`, `health.ts`; stubs `src/api/links.ts`, `gallery.ts`, `read.ts`, `src/visitor/routes.ts`; `src/crypto/random.ts`, `password.ts`, `compare.ts`; `src/db/links.ts`, `variants.ts`, `signoffs.ts`, `sessions.ts`; `test/setup.ts` and the tests below. In the app: `src/shared/approvals/contract.ts`; `tests/unit/config/approvals-contract.test.ts`; `tests/unit/shared/approvals/contract-ids.test.ts`.
- **May touch:** `.gitignore`, `eslint.config.js` (ignore lines only), `.prettierignore`.
- **Read:** `spec/approvals-service.md` "What it is", "Folder and tooling", "The shared contract", "Database (D1)", "Random values and passwords", "The keyed API" (order of checks, error body); `spec/infra-and-settings.md` "Packages: licences and install scripts". **Check first** in Cloudflare's current docs: the Vitest plugin's setup (`cloudflareTest`, `readD1Migrations`, `applyD1Migrations`), the supported Vitest version, and the Workers types to use. Report each package's licence and every `allowScripts` entry.
- **Tests:** `test/contract.test.ts`, `test/random.test.ts`, `test/password.test.ts`, `test/api-auth.test.ts` (against health), `test/config.test.ts`, `test/worker.test.ts`, `test/db.test.ts` (each access function round trip; a link delete batch removes sessions, sign-offs and gallery rows of that link only). Root: the contract copy test; `contract-ids.test.ts` (200 IDs from the app's campaign and variant ID makers and from `ulid` pass the contract).
- **Class:** S + A. Security class, full review (the key check, the hash, the tooling). **After:** nothing.

### AP-2 — Service: link API

- **Exists when done:** every `/api/v1/links` route answers as `spec/approvals-service.md` says, with `checkPictureUrl` (the test origin included) guarding every picture address.
- **New files:** the bodies of `src/api/links.ts`, `gallery.ts`, `read.ts`; `src/pictures/check-url.ts`.
- **May touch:** `src/db/*.ts` (a query a route needs; no table change).
- **Read:** `spec/approvals-service.md` "The keyed API", "Database (D1)", "Pictures" (`checkPictureUrl` only).
- **Tests:** `test/api-links.test.ts`, `test/picture-url.test.ts`.
- **Class:** S. Security class, full review. **After:** AP-1.

### AP-3 — Service: visitor pages and sessions

- **Exists when done:** the password page, the session, the wrong-password limit, "Leave", the gallery page (with its sign-off forms drawn), `/gallery.css` and `/robots.txt` work, with the escaping template and the exact headers.
- **New files:** the body of `src/visitor/routes.ts`; `src/visitor/password-page.ts`, `gallery-page.ts`, `html.ts`, `styles.ts`, `headers.ts`, `forms.ts`, `session.ts`, `throttle.ts`.
- **May touch:** `src/db/*.ts` (a query a route needs; no table change).
- **Read:** `spec/approvals-service.md` "Visitor pages" (all of it), "Random values and passwords".
- **Tests:** `test/session.test.ts`, `test/throttle.test.ts`, `test/forms.test.ts` (rows for `/enter` and `/leave`), `test/pages.test.ts`.
- **Class:** S. Security class, full review. **After:** AP-1.

### AP-4 — Service: sign-offs and pictures

- **Exists when done:** a visitor can sign off and remove a sign-off; the picture route passes on a picture fetched through `PictureSource` with every check.
- **New files:** `src/visitor/signoffs.ts`, `picture-route.ts`; `src/pictures/source.ts`, `s3-source.ts`, `sniff.ts`.
- **May touch:** `src/visitor/routes.ts` (the three routes' lines); `src/app.ts` (the default `PictureSource` in `parts`); `src/db/*.ts`.
- **Read:** `spec/approvals-service.md` "Forms that write", "Pictures".
- **Tests:** `test/signoffs.test.ts`, `test/picture-route.test.ts`. Approved addition: `test/forms.test.ts` gains rows for the two sign-off routes.
- **Class:** S. Security class, full review. **After:** AP-2, AP-3.

### AP-5 — Desktop contracts

- **Exists when done:** migration `0004_approvals`; the `approvals.baseUrl` setting with its load rule; the secret name `approvals.apiKey`; the command, query and event schemas; the reasons and sentences; the address rule; the policy rows; every approvals command and query registered against a stub; `deps.approvals` wired with stub stores.
- **New files:** `src/main/db/schema/approvals.ts`; `src/main/db/migrations/0004_approvals.sql` with its snapshot and journal entry (by `npm run db:generate`); `src/shared/schemas/commands/approvals.ts`, `src/shared/schemas/queries/approvals.ts`; `src/shared/approvals/address.ts`, `messages.ts`; `src/main/approvals/types.ts`, `deps.ts`. Stubs (each replaced by its slice): `src/main/approvals/password-store.ts`, `picture-store.ts`; `src/main/commands/approvals/index.ts` with `set-service.ts`, `check.ts`, `create-link.ts`, `set-password.ts`, `publish.ts`, `refresh.ts`, `end-link.ts`; `src/main/queries/approvals.ts`. A stub command refuses in `prepare` with `RULE_VIOLATION`, reason `approvals_not_set_up`; the stub `approvals.forCampaign` answers `{ ready: 'no_service', link: null, variants: [] }`, and `approvals.getPassword` `{ password: null }`, both refusing an agent already.
- **May touch:** `src/main/db/schema/index.ts`; `src/shared/schemas/settings.ts`; `src/main/settings/defaults.ts`, `settings-store.ts` (the load rule); `src/shared/schemas/secrets.ts`; `src/shared/schemas/events.ts`; `src/main/commands/agent-policy.ts`; `src/main/queries/queries.ts`; `src/main/core.ts` (one spread line, the `approvals` deps line); `src/main/core-deps.ts` (one field); the file that lists refusal reasons, if one does; any file whose exhaustive table over a changed union stops compiling (one line each, named in the report).
- **Read:** `spec/approvals.md` "Settings", "Local tables", "Commands" (the table and shared refusals), "Queries and the event", "Security" (rules); `spec/data-rules.md` "Data migration"; `spec/mcp-and-agents.md` "Agent policy table"; `spec/infra-and-settings.md` "settings.json".
- **Tests:** `tests/integration/db/migration-0004.test.ts` (as `spec/approvals.md` says); `tests/unit/shared/approvals/address.test.ts`; `tests/unit/main/settings/settings-store-approvals.test.ts`; `tests/unit/shared/schemas/approvals-schemas.test.ts` (each input: a good value and each refused field; the password rule); `tests/integration/approvals/agent-denied.test.ts` (every approvals command as the agent gets `AGENT_DENIED`; both queries refuse the agent; `settings.update` with an `approvals` key is refused). Approved edits: `tests/unit/main/commands/agent-policy-table.test.ts` (the seven rows); `tests/integration/db/migration-0003.test.ts` (opens with the first four migrations only, if it opens all today); any test that states the newest `schema_version` (5); any test that lists command, query, event or secret names, or `CoreDeps` fields (`tests/integration/registration.test.ts`); settings tests that compare the whole default settings object.
- **Class:** B + A. Security class, short review (policy rows, migration, the settings writer, the address rule). **After:** AP-1; P4-10 merged.

### AP-6 — Service client, service settings, kept passwords

- **Exists when done:** the client talks to the service as `spec/approvals.md` "The service client" says; `approvals.setService` and `approvals.check` work; the password store keeps, reads and forgets passwords; `makePassword` and `requireApprovalsReady` exist; a stand-in service runs in the test process.
- **New files:** `src/main/approvals/client.ts`, `request.ts`, `failure.ts`, `make-password.ts`, `ready.ts`; the bodies of `password-store.ts`, `commands/approvals/set-service.ts`, `check.ts`; `tests/helpers/approvals-stand-in.ts` (a Node `http` server on `127.0.0.1` that keeps links, galleries and sign-offs in memory under the contract; checks the key; records requests; can plant sign-offs, answer a set status, redirect, or send an oversized or wrongly shaped reply once; serves `/adman-approvals/...` from a folder it is given, for the test picture store).
- **Read:** `spec/approvals.md` "Settings", "The service client", "Kept passwords", "Commands" (`setService`, `check`, shared refusals); `spec/comfyui.md` (its client's `Agent` and no-proxy rules, as the model); `spec/security.md` "Keys and secrets".
- **Tests:** `tests/integration/approvals/client.test.ts` (the named cases); `tests/unit/main/approvals/password-store.test.ts` (round trip; forget; unreadable file never written over; no encryption refuses; no `.tmp` left); `tests/unit/main/approvals/make-password.test.ts` (shape; only the alphabet; with a fixed byte source, bias-free drawing); `tests/integration/approvals/set-service.test.ts` (saves the origin; refuses `http` without dev tools; null removes; `app.stateChanged` sent); `tests/integration/approvals/check.test.ts` (connected; each failure kind's sentence; no address or key). Approved addition: `tests/integration/mcp/secret-leak.test.ts` plants the approvals address and key.
- **Class:** B + E. Security class, full review (outbound calls, the key, the password store). **After:** AP-5.

### AP-7 — Pictures: signed addresses and the picture store

- **Exists when done:** the S3 adapter signs read addresses on this machine; the picture store puts, signs, lists and removes inside a campaign's folder only, through S3 or, under its condition, the test folder.
- **New files:** `src/main/providers/s3/signed-url.ts`; `src/shared/approvals/picture-paths.ts`; `src/main/approvals/s3-picture-store.ts`, `test-picture-store.ts`; the body of `picture-store.ts` (`choosePictureStore`).
- **May touch:** `src/main/providers/types.ts` (the optional `signedReadUrl` on `StorageProvider`); `src/main/providers/s3/index.ts` or `s3-storage.ts` (attach it); `package.json` and `package-lock.json` (`@aws-sdk/s3-request-presigner`, pinned; report its licence and `npm ls @smithy/node-http-handler`).
- **Read:** `spec/approvals.md` "Pictures"; `spec/storage-and-publish.md` "Storage interface", "Path rules", "Amazon S3" (allowed hosts).
- **Tests:** `tests/unit/main/providers/s3/signed-url.test.ts` (the named cases); `tests/unit/shared/approvals/picture-paths.test.ts` (each bad part refused with "Storage path refused"; the exact path shapes); `tests/unit/main/approvals/s3-picture-store.test.ts` (with a stand-in `StorageProvider`: calls only inside the folder; `NEEDS_KEY` without keys); `tests/integration/approvals/test-picture-store.test.ts` (used only with dev tools and the variable set to a `127.0.0.1` origin; a link in place of the folder refused; writes inside the folder only). The storage conformance cases must pass unchanged.
- **Class:** E + A. Security class, full review (signing, storage paths, a new package). **After:** AP-5.

### AP-8 — Link commands and the queries

- **Exists when done:** `approvals.createLink`, `approvals.setPassword`, `approvals.endLink`, `approvals.forCampaign` and `approvals.getPassword` work as `spec/approvals.md` says, through the one local store.
- **New files:** `src/main/approvals/local-store.ts`; the bodies of `commands/approvals/create-link.ts`, `set-password.ts`, `end-link.ts` and `src/main/queries/approvals.ts`.
- **Read:** `spec/approvals.md` "Local tables", "Kept passwords", "Commands" (`createLink`, `setPassword`, `endLink`), "Queries and the event", "Security" (project-file values).
- **Tests:** `tests/integration/approvals/create-link.test.ts` (each shared refusal in order; a made password's shape; a chosen password's rule; the `409` take-over; an ended link replaced and its sign-offs cleared; the password kept; `approvals.changed` sent); `set-password.test.ts` (sent; kept; the stand-in saw its sessions ended); `end-link.test.ts` (last read kept; the stand-in's link gone; the picture folder emptied and a file beside it untouched; the password forgotten; an already-gone link still ends locally); `for-campaign.test.ts` (each `ready` value; the address; `passwordKept`; variants in `campaign.get` order; `current`; a row with a bad slug or email skipped and logged without its value); `tests/unit/main/approvals/local-store.test.ts`.
- **Class:** B. Security class, full review (deletes in the bucket and on the service, the password). **After:** AP-6, AP-7.

### AP-9 — Update gallery and refresh

- **Exists when done:** `approvals.publish` and `approvals.refresh` work as `spec/approvals.md` says, with renewal of picture addresses.
- **New files:** `src/main/approvals/publish.ts`, `refresh.ts`, `renew.ts`; the bodies of `commands/approvals/publish.ts`, `refresh.ts`.
- **Read:** `spec/approvals.md` "Commands" (`publish`, `refresh`), "Pictures", "Versions and marks"; `spec/scene.md` "The render service".
- **Tests:** `tests/integration/approvals/publish.test.ts` (with a stand-in draw: only changed variants drawn; the file path holds the drawn `rev`; the gallery body; a failure at draw, upload, signing or the service leaves the stand-in's gallery unchanged and removes this run's files; old files removed after success; over 500 variants refused; the render sentence names the title; one `approvals.changed`); `refresh.test.ts` (sign-offs replaced; renewal only under 2 days and only for matching versions; a renewal failure does not stop it; a gone link becomes `ended` with its reason; no event when nothing changed; a stand-in reply with a script-bearing or non-ASCII email refused as `other`); `tests/integration/approvals/picture-paths.test.ts` (the named isolation test over publish and end).
- **Class:** B + E. Security class, full review. **After:** AP-8.

### AP-10 — Settings: approvals service and S3

- **Exists when done:** Settings has "Cloud storage" (Amazon S3) and "Approvals service" as `spec/approvals.md` "Screens" says.
- **New files:** `src/renderer/screens/settings/approvals-section/`, `src/renderer/screens/settings/s3-section/`.
- **May touch:** `src/renderer/screens/settings/settings-screen/settings-screen.tsx` (mount both, a few lines).
- **Read:** `spec/approvals.md` "Settings", "Screens" (Settings); `spec/screens.md` "Rules for every screen"; `spec/storage-and-publish.md` "Amazon S3", "Storage settings screen".
- **Tests:** `tests/unit/renderer/screens/settings/approvals-section.test.tsx` (save sends `approvals.setService`; a refusal's sentence shown; Remove sends null; key saved with `secret.set` and shown by last four; Test connection shows "Connected." or the sentence; axe); `s3-section.test.tsx` (bucket, region, folder saved in one `settings.update`; a region refusal shown; both keys; the permissions line; axe). Shots: `tests/shots/ap-10.shots.ts`: `90-settings-cloud-storage`, `91-settings-approvals-service` (with the stand-in, dev tools on).
- **Class:** D. Not security class. **After:** AP-6.

### AP-11 — Approval dialog, bar and store

- **Exists when done:** the campaign page has the approval bar; "Approval link…" opens the dialog in each of its states; the store refreshes on its timer and on focus.
- **New files:** `src/renderer/stores/approvals-store.ts`; `src/renderer/screens/campaign/approval-bar/`; `src/renderer/dialogs/approval-dialog/` (`approval-dialog.tsx`, `password-choice.tsx`, `live-link.tsx`, `end-link-confirm.tsx`); `src/renderer/ui/signoff-list/`.
- **May touch:** `src/renderer/screens/campaign/campaign-view/campaign-view.tsx` (makes the store, mounts the bar in the header row; a few lines).
- **Read:** `spec/approvals.md` "Screens" (the campaign page, the dialog), "Queries and the event", "Commands" (sentences); `spec/screens.md` "Rules for every screen".
- **Tests:** `tests/unit/renderer/stores/approvals-store.test.ts` (fake timers: refresh on open, every 60 s with focus, none without, on focus; one at a time; stops on unmount; a failure kept for the bar and not sent to the banner; reads again on `approvals.changed` and `project.changed`; not ready sends no refresh); `tests/unit/renderer/dialogs/approval-dialog.test.tsx` (each state; "Make link" sends `createLink` then `publish`; a chosen password under 12 characters keeps the button disabled; copy link; copy password reads `getPassword` on click and never draws it; not kept shows its line; set password; update gallery with its waiting line; turn off opens the confirmation with "Keep link" focused; Escape and Cancel send nothing; axe); `approval-bar.test.tsx`; `tests/unit/renderer/ui/signoff-list.test.tsx` (newest first; earlier-version line; an email holding `<b>` drawn as text). Shots: `tests/shots/ap-11.shots.ts`: `92-approval-dialog-new`, `93-approval-dialog-live`, `94-approval-dialog-turn-off`, `95-campaign-approval-bar`.
- **Class:** D. Security class, short review (the password in the window). **After:** AP-9; P4-12 merged.

### AP-12 — Tile marks

- **Exists when done:** each tile shows its approval marks and a "Sign-offs ({n})" list, for one variant or many.
- **New files:** `src/shared/approvals/marks.ts`; `src/renderer/screens/campaign/approval-mark/`.
- **May touch:** `src/renderer/screens/campaign/variant-tile/variant-tile.tsx` (the `footer` prop), `variant-grid/variant-grid.tsx` (the `tileFooter` prop), `campaign-view/campaign-view.tsx` (passes `tileFooter`); a few lines each.
- **Read:** `spec/approvals.md` "Versions and marks", "Screens" (tile marks); `spec/screens-campaign.md` "The campaign grid and the variant tile".
- **Tests:** `tests/unit/shared/approvals/marks.test.ts` (one table over every row of the marks table); `tests/unit/renderer/screens/campaign/approval-mark.test.tsx` (marks; the toggle's `aria-expanded`; the list; 30 variants draw 30 marks; axe). Approved additions: the `variant-tile` and `variant-grid` tests gain the footer cases. Shots: `tests/shots/ap-12.shots.ts`: `96-tile-marks`, `97-tile-signoff-list`.
- **Class:** A + D. Not security class. **After:** AP-11.

### AP-13 — Local end-to-end proof, deploy steps, exit check

- **Exists when done:** the exit criteria above pass; the spec's `Not built` marks for this feature are listed for the orchestrator to turn to `Built`.
- **New files:** `tests/e2e/approvals.spec.ts` (offline, in `test:e2e`: the stand-in service and the test picture store; Settings, make link, update gallery, a sign-off planted in the stand-in, Refresh, the marks; an edit, "Changed since sign-off", update, the earlier-version line); `playwright.approvals.config.ts` and `tests/approvals-local/` (`global-setup.ts`: applies the migrations with `wrangler d1 migrations apply DB --local --persist-to {temporary folder}`, starts `wrangler dev --ip 127.0.0.1 --port {free port} --persist-to {same} --var API_KEY:{a value made for this run} --var TEST_PICTURE_ORIGIN:http://127.0.0.1:{picture port}` with `WRANGLER_SEND_METRICS=false`, starts a static server on the picture port for the app's test picture folder, waits for the health route; `approvals-local.spec.ts`: the flow in the exit criteria, the visitor in a Playwright Chromium page; it saves `98-gallery-password` and `99-gallery` to `shots/`); `approvals-service/README.md` (the steps and values of `spec/approvals-service.md` "Deploying").
- **May touch:** root `package.json` (script `test:approvals-local`: `npm run build && playwright test --config playwright.approvals.config.ts`); `approvals-service/package.json` (scripts `dev`, `db:local`).
- **Read:** this file; `spec/approvals-service.md` "Running it locally", "Deploying"; `spec/test-harnesses.md` "Offline end-to-end harness".
- **Check first:** that Chromium keeps the `__Host-` cookie from `http://127.0.0.1`; if not, the run uses `localhost` for the service and says so. If Playwright's Chromium is not installed, report it rather than download it unasked.
- **Tests:** the two specs. No CI workflow names `test:approvals-local`. The developer lists the stakeholder's checks: deploy with the README; one "Update gallery" to his real S3 bucket and one visitor sign-off through the deployed service; Windows (D-087).
- **Class:** G + S. Security class, short review (the test doors are only test doors). **After:** every other AP slice.

## Left for later

In `spec/approvals.md`, "Left for later": video variants as stills, R2 for pictures, a job with progress for big galleries, links of deleted campaigns, MCP tools.
