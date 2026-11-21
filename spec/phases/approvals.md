# Approvals by link

**Goal:** A user can make a password-protected link for a campaign, reviewers can sign off on its variants from a browser with an email address, and the sign-offs show in the app [D-095]. Built beside Phase 4 and the look pack without holding either back (the stakeholder's words: "This feature should be built in parallel to not block the phases ahead").

**Exit criteria**

- The service's own checks pass on this machine: in `approvals-service/`, `npm run typecheck`, `npm test`, `npm run build` and `npm run test:e2e`; at the root, `npm run lint`.
- The app's checks pass: lint, typecheck, `npm test` (with `migration-0004.test.ts` and the contract test), build, `test:build`, `npm run test:e2e` (with `tests/e2e/approvals.spec.ts` against the stand-in service).
- `npm run test:approvals-local` passes once (AP-13): the real service under `next start` on `127.0.0.1` with a local database file, the built app beside it, and a real browser as the visitor. The flow: set up the service in Settings, make a link, update the gallery, open the link, a wrong password, the right one, sign off; the app shows "Signed off by 1"; edit the variant; the app shows "Changed since sign-off"; update the gallery; the sign-off shows "for an earlier version" in the gallery and in the app; turn the link off; the link shows the password page and nothing else.
- Shots 90 to 99 made and named in the reports (98 and 99, the visitor's pages, by AP-16).
- `approvals-service/README.md` holds the deploy steps and the list of values the stakeholder supplies, with no value written in.
- No agent has deployed anything, signed in to Vercel or a database host, or contacted a deployed service or a hosted database (D-086).

**Dependencies:** Phase 3 merged; P4-10 merged before AP-5 (it edits `core.ts`); P4-12 merged before AP-11 (it edits `campaign-view/`). The service slices need nothing from the app.

**Design:** `spec/approvals.md` (desktop side, security rules and threats, assumptions A-82 to A-109), `spec/approvals-service.md` (the service: Next.js on Vercel, the database, the API, the visitor logic) and `spec/approvals-gallery.md` (the visitor's pages) [D-097]. Questions for the stakeholder: OI-95 to OI-97 in `spec/open-items.md` and the questions of D-097.

## Rules for these slices

- Every slice: write the failing tests first, then the code; run what its class asks. A slice that touches the renderer runs `npm run test:e2e` too. Prefer one table test over many near-identical cases.
- **Class S (the service):** root `npm run lint`; in `approvals-service/`, `npm run typecheck` and `npm test`. **Class S+W (the service, served):** class S, then in `approvals-service/` `npm run build` and `npm run test:e2e`; for any slice that touches `app/`, `proxy.ts`, `next.config.ts`, `package.json` or `src/server/`. Other classes as in `spec/testing.md`.
- A slice edits only the files it owns and the existing files it may touch. A change needed elsewhere: stop and report.
- **Service slices touch only `approvals-service/`.** AP-1 also added the root ignore lines, the app's copy of the contract and the two root contract tests; AP-14 changes the ignore lines; AP-16 may widen the root lint's file pattern to `approvals-service/**/*.tsx`. So the service slices may run beside any Phase 4, look-pack or desktop approvals slice. Only one service slice runs at a time (they share `src/visitor/` and `package.json`).
- **The contract.** Only AP-1 writes `src/shared/approvals/contract.ts` and its copy. A later slice that finds it must change stops and reports; the architect rules, and the change goes into both copies in one commit.
- **Nothing leaves this machine** (D-086). No `vercel` command of any kind (`login`, `link`, `deploy`, `env pull`, `install`), no `npm run db:migrate -- --hosted`, no `libsql://` or other hosted database address, no `npx` tool that signs in. No test contacts a deployed service, a hosted database or a real S3 bucket. Every script that runs `next` sets `NEXT_TELEMETRY_DISABLED=1`. Installing packages with npm is allowed. If any tool asks to sign in, stop and report.
- **No paid call and no real S3.** S3 code is tested with stand-ins and by signing on this machine (signing sends nothing). The stakeholder's own check with a real bucket comes after deploying.
- **One migration.** Only AP-5 runs `npm run db:generate` (`0004_approvals`). If a Phase 4 or look-pack slice needs a migration before AP-5 merges, both stop and the orchestrator orders them.
- **Shared files.** Only AP-5 edits `agent-policy.ts`, `events.ts`, `queries/queries.ts`, the Drizzle schema index, `settings.ts`, `secrets.ts`, `core-deps.ts`, and the `core.ts` spread and deps lines. AP-5 registers every approvals command and query against a stub file; the slice that owns the stub replaces its body and touches no index. After AP-5 merges, AP-10b adds one `agent-policy.ts` row for `storage.checkS3`. `src/main/approvals/deps.ts` (AP-5) imports `createPasswordStore` from `password-store.ts` and `choosePictureStore` from `picture-store.ts`, both stubs from AP-5, so AP-6 and AP-7 never edit the same file.
- **Screens** (D-084): one folder per component, CSS from the existing tokens only. No slice here adds a token, so none edits `tokens.css`. A screen slice's edit to an existing component is a mount point of a few lines, named in the slice. Each screen slice adds `tests/shots/ap-{n}.shots.ts` (for example `tests/shots/ap-10.shots.ts`); picture names start with the numbers given in the slice, from the range 90 to 99 kept for this feature.
- **Security class.** Slices marked "full" merge only after a full security review; "short" after a short one.
- Budget: one slice per developer run, well under 300k tokens; hand off with `HANDOFF.md` if near it.

## Order and side-by-side work

| Wave | Slice | Waits for | May run beside | Must not run beside |
|------|-------|-----------|----------------|---------------------|
| 1 | AP-1 Service skeleton, contract, database (built) | Nothing | Every Phase 4 and look-pack slice | Nothing |
| 2 | AP-2 Service: link API (built) | AP-1 | AP-3, AP-5, every Phase 4 and look-pack slice | Nothing |
| 2 | AP-3 Service: visitor logic and sessions (built) | AP-1 | AP-2, AP-5, every Phase 4 and look-pack slice | Nothing |
| 2 | AP-5 Desktop contracts | AP-1; P4-10 merged | Any service slice, the look pack, Phase 4 screen slices | P4-10 (`core.ts`); any slice that adds a migration or edits `agent-policy.ts`, `events.ts`, `queries.ts`, `settings.ts` or `secrets.ts` (none is planned in Phase 4 or the look pack) |
| 3 | AP-14 Service: move to Next.js and libSQL | AP-2, AP-3 and the AP-3 review fixes merged | Every desktop, Phase 4 and look-pack slice | Every other service slice |
| 4 | AP-15 Service: visitor replies for the page app | AP-14 | The same | Every other service slice |
| 5 | AP-4 Service: sign-offs and pictures | AP-15 | The same | Every other service slice |
| 6 | AP-16 Gallery pages | AP-4 | The same | Every other service slice |
| 3 | AP-6 Service client, service settings, kept passwords | AP-5 | AP-4, AP-7 | Nothing |
| 3 | AP-7 Pictures: signed addresses and the picture store | AP-5 | AP-4, AP-6 | Any slice that edits `package.json`, `src/main/providers/types.ts` or `src/main/providers/s3/` (AP-10b waits for AP-7) |
| 4 | AP-8 Link commands and the queries | AP-6, AP-7 | AP-10 | Nothing |
| 4 | AP-10 Settings: approvals service (AP-10a, the S3 part, built) | AP-6 | AP-8, AP-9, AP-10b | Nothing (`settings-screen.tsx` has no other planned editor) |
| 4 | AP-10b Test connection for S3 | AP-5, AP-7 | AP-8, AP-9, AP-10, AP-11, Phase 4 and look-pack slices | Any slice that edits `src/main/commands/storage/`, `src/main/providers/s3/`, `s3-section/` or `agent-policy.ts` (none is planned) |
| 5 | AP-9 Update gallery and refresh | AP-8 | AP-10 | Nothing |
| 6 | AP-11 Approval dialog, bar and store | AP-9; P4-12 merged | AP-10 | P4-12 and AP-12 (`campaign-view/`) |
| 7 | AP-12 Tile marks | AP-11 | Phase 4 and look-pack slices | P4-12 and AP-11 (`campaign-view/`); any slice editing `variant-tile/` or `variant-grid/` (none is planned) |
| 8 | AP-13 Local end-to-end proof, deploy steps, exit check | Every other AP slice | Phase 4 and look-pack slices | Nothing |

The service slices AP-14, AP-15, AP-4 and AP-16 run one after another, each in `approvals-service/` only, so they never share a file with a desktop slice; the desktop waves (AP-6 to AP-12) keep their own order beside them. No two desktop slices of one wave edit the same file: wave 3 by folder (the app's client and password store, the app's picture store and S3 adapter); wave 4 by main process against Settings screens, with AP-10b in the storage command folder, the S3 adapter folder and `s3-section/` only. The move to Next.js and Vercel changes no desktop slice: the app knows only a service address and a key (D-097).

## Slices

### AP-1 — Service skeleton, contract, database (built)

Built on the earlier host (a Cloudflare Worker with D1, the Workers Vitest pool). Its Worker files (`wrangler.jsonc`, `src/index.ts`, the Workers test set-up) are removed or replaced by AP-14; its contract, database, crypto and route tables stay.

- **Exists when done:** `approvals-service/` installs, type-checks and tests on this machine; `wrangler.jsonc`, the D1 migration and its data-access functions exist; the router registers every route of `spec/approvals-service.md` against stub handlers (an API stub answers `404 not_found`, a visitor stub `404` "Not found."), and `GET /api/v1/health` works with the full key check; the contract exists in both places with the copy test; the password hash and the random letters work.
- **New files:** `approvals-service/package.json`, `tsconfig.json`, `wrangler.jsonc`, `vitest.config.ts`, `migrations/0001_init.sql`; `src/index.ts`, `app.ts`, `env.ts`, `contract.ts`; `src/api/auth.ts`, `body.ts`, `errors.ts`, `health.ts`; stubs `src/api/links.ts`, `gallery.ts`, `read.ts`, `src/visitor/routes.ts`; `src/crypto/random.ts`, `password.ts`, `compare.ts`; `src/db/links.ts`, `variants.ts`, `signoffs.ts`, `sessions.ts`; `test/setup.ts` and the tests below. Added as built: `src/api/route.ts`, `test/env.d.ts`, `test/tsconfig.json`, `test/routes.test.ts`. In the app: `src/shared/approvals/contract.ts`; `tests/unit/config/approvals-contract.test.ts`; `tests/unit/shared/approvals/contract-ids.test.ts`.
- **May touch:** `.gitignore` (it also ignores `approvals-service/worker-configuration.d.ts`), `eslint.config.js` (ignore lines only), `.prettierignore`.
- **Read:** `spec/approvals-service.md` "What it is", "Folder and tooling", "The shared contract", "Database (D1)", "Random values and passwords", "The keyed API" (order of checks, error body); `spec/infra-and-settings.md` "Packages: licences and install scripts". **Check first** in Cloudflare's current docs: the Vitest plugin's setup (`cloudflareTest`, `readD1Migrations`, `applyD1Migrations`), the supported Vitest version, and the Workers types to use. Report each package's licence and every `allowScripts` entry.
- **Tests:** `test/contract.test.ts`, `test/random.test.ts`, `test/password.test.ts`, `test/api-auth.test.ts` (against health), `test/config.test.ts`, `test/worker.test.ts`, `test/db.test.ts` (each access function round trip; a link delete batch removes sessions, sign-offs and gallery rows of that link only). Root: the contract copy test; `contract-ids.test.ts` (200 IDs from the app's campaign and variant ID makers and from `ulid` pass the contract).
- **Class:** S + A. Security class, full review (the key check, the hash, the tooling). **After:** nothing.

### AP-2 — Service: link API (built)

- **Exists when done:** every `/api/v1/links` route answers as `spec/approvals-service.md` says, with `checkPictureUrl` (the test origin included) guarding every picture address.
- **New files:** the bodies of `src/api/links.ts`, `gallery.ts`, `read.ts`; `src/pictures/check-url.ts`.
- **May touch:** `src/db/*.ts` (a query a route needs; no table change); `src/env.ts` (the `TEST_PICTURE_ORIGIN` check, written here, not in AP-1); `src/app.ts` (the two `check` lines).
- **Must not get wrong** (security review): replies are built field by field or through the reply schema, never from a database row (rows hold the hash, salt, internal ID and picture address); a new password is one batch with ending the link's sessions.
- **Read:** `spec/approvals-service.md` "The keyed API", "Database", "Pictures" (`checkPictureUrl` only).
- **Tests:** `test/api-links.test.ts`, `test/picture-url.test.ts`.
- **Class:** S. Security class, full review. **After:** AP-1.

### AP-3 — Service: visitor logic and sessions (built)

- **As built** (on the earlier host, with its review's fixes): entering (`visitor/actions.ts` `enterLink`), the try limit (`throttle.ts`, `db/enter.ts`), sessions and the cookie (`session.ts`, with the session inserted only while the checked salt and hash are still the link's), the form checks (`forms.ts`), leaving, the narrowed `GalleryView` from `openGallery` (raw rows never leave the logic), the slug shape checked first, and the header sets (`headers.ts`). It also drew hand-written HTML pages (`html.ts`, `password-page.ts`, `gallery-page.ts`, `styles.ts`, `test/pages.test.ts`), which AP-15 removes in favour of the Next.js pages (D-097).
- **Tests as built:** `test/session.test.ts`, `test/throttle.test.ts`, `test/forms.test.ts`, `test/pages.test.ts`.
- **Class:** S. Security class, full review (done).

### AP-14 — Service: move to Next.js and libSQL

- **Exists when done:** `approvals-service/` is a Next.js `16.4.6` app; every request goes through `app/[[...path]]/route.ts` to the unchanged `createApp`, so the keyed API, the visitor routes and the hand-written pages still answer exactly as before; the database is reached through `src/db/client.ts` over `@libsql/client`; every test from AP-1 to AP-3 passes in plain Node Vitest with the same assertions; `next build` and `next start` work on `127.0.0.1`; nothing of Wrangler or the Workers runtime is left.
- **New files:** `next.config.ts`, `playwright.config.ts`, `scripts/migrate.ts`, `app/[[...path]]/route.ts`, `app/layout.tsx` (the bare `<html>` and `<body>`, needed by `next build`; AP-16 fills it), `src/db/client.ts`, `src/server/env.ts`, `src/server/serve.ts`, `test/db.ts`, `test/empty.ts`, `test/db-client.test.ts`, `test/entry.test.ts` (replacing `test/worker.test.ts`), `e2e/api.spec.ts`.
- **Removes:** `wrangler.jsonc`, `src/index.ts`, `test/setup.ts`, `test/env.d.ts`, `test/worker.test.ts`; the packages `wrangler` and `@cloudflare/vitest-plugin`.
- **May touch:** `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `test/tsconfig.json`; `src/env.ts` and `src/db/*.ts`, `src/visitor/actions.ts`, `session.ts`, `throttle.ts` (type names only, "What changes in each file"); `src/crypto/compare.ts` (`node:crypto` `timingSafeEqual`); the `import 'server-only'` line in `src/db/`, `src/crypto/`, `src/pictures/`, `src/server/`; `test/api-helpers.ts`, `test/visitor-setup.ts` and every `test/*.test.ts` (harness lines only, the port table in `spec/approvals-service.md` "Tests"); `test/config.test.ts` (rewritten); root `.gitignore`, `eslint.config.js` (ignore lines), `.prettierignore`.
- **Must not get wrong** (security review): the key check's order, the 2 MiB and 8 KiB caps, every header set and every reply are byte-for-byte as before (the existing tests prove it, and they change only in harness lines); `timingSafeEqual` keeps the equal-length rule; `TEST_PICTURE_ORIGIN` is dropped whenever `VERCEL` is set; a missing database address means not set up; the migrate script refuses a hosted address without `--hosted`; no statement from the libSQL client leaks a row type past `client.ts`.
- **Check first:** that `next build` accepts the root optional catch-all (`spec/approvals-service.md`, "How Next.js and the service code fit"; stop and report before using the fallback); that `@libsql/client` runs `:memory:` and `file:` with no network; the packages' licences and install scripts against the table in `spec/approvals-service.md` "Folder and tooling" (report every `allowScripts` entry).
- **Read:** `spec/approvals-service.md` "How Next.js and the service code fit", "Folder and tooling", "Database" (all), "Environment", "Tests" (the port), "Running it locally".
- **Tests:** every existing test file, ported; `test/db-client.test.ts`, `test/entry.test.ts`, `test/config.test.ts`; `e2e/api.spec.ts`. The report gives the test count per file before and after.
- **Shots:** none.
- **Class:** S+W. Security class, full review (it touches reviewed code, the key check's path and the crypto). **After:** AP-2, AP-3 and its review fixes merged.

### AP-15 — Service: visitor replies for the page app

- **Exists when done:** the catch-all's visitor replies are only plain text, `303`s and (from AP-4) pictures: a failed entry is the one `303` to `/l/{slug}?m=wrong-password`; the `403` and `404` use the plain text headers; the notices table exists; `openGallery` takes `{ slug, cookie, m }` and `readSession` the cookie text; `pagePolicy(nonce)` and the page header set exist in `headers.ts`; the hand-written HTML is gone. Until AP-16, `GET /l/{slug}` answers the plain 404 (nothing is deployed in between).
- **New files:** `src/visitor/notices.ts`; `test/view.test.ts`, `test/headers.test.ts`.
- **Removes:** `src/visitor/html.ts`, `password-page.ts`, `gallery-page.ts`, `styles.ts`; `test/pages.test.ts`; the `gallery` and `stylesheet` rows of `VISITOR_ROUTES`.
- **May touch:** `src/visitor/routes.ts`, `actions.ts`, `session.ts`, `headers.ts`; `test/throttle.test.ts`, `test/session.test.ts`, `test/forms.test.ts`, `test/entry.test.ts`, `test/visitor-setup.ts` (the replies they expect).
- **Must not get wrong** (security review): the three entry failures stay byte-equal and the unknown slug still runs the dummy hash; the view keeps exactly its fields; `m` only through the table; every redirect a `303` from the checked slug; the cookie set and cleared only here.
- **Read:** `spec/approvals-service.md` "Visitor routes and logic" (all), "Headers on replies from the catch-all"; `spec/approvals-gallery.md` "The page policy and nonce".
- **Tests:** as named; the throttle test's byte-equal check now over the three `303`s.
- **Shots:** none.
- **Class:** S. Security class, full review. **After:** AP-14.

### AP-4 — Service: sign-offs and pictures

- **Exists when done:** a visitor can sign off and remove a sign-off; the picture route passes on a picture fetched through `PictureSource` with every check, as a stream.
- **New files:** `src/visitor/signoffs.ts`, `picture-route.ts`; `src/pictures/source.ts`, `s3-source.ts`, `sniff.ts`; `e2e/pictures/` (two small PNG files and one JPEG made by the test, not downloaded).
- **May touch:** `src/visitor/routes.ts` (the three routes' lines); `src/app.ts` and `src/server/serve.ts` (the default `PictureSource` in `parts`); `src/db/signoffs.ts`, `variants.ts`; `playwright.config.ts` (the picture server in `globalSetup`); `test/forms.test.ts` (rows for the two sign-off routes).
- **Must not get wrong** (security review): the sign-off is the one conditional `INSERT … SELECT` from `gallery_variant` for this link and version; `checkPictureUrl` runs on the parsed `URL` right before the fetch and that same object is fetched; `redirect: 'manual'`; any non-200 fails; no visitor header passed on; the 16 MiB cap and the sniff before the first byte is sent; every failure a `404` with an empty body; the stored address never in a reply or log.
- **Read:** `spec/approvals-service.md` "Forms that write", "Pictures", "Environment" (`TEST_PICTURE_ORIGIN`).
- **Tests:** `test/signoffs.test.ts`, `test/picture-route.test.ts` (with `s3-source` against a local Node server).
- **Shots:** none.
- **Class:** S+W. Security class, full review. **After:** AP-15.

### AP-16 — Gallery pages

- **Exists when done:** `GET /l/{slug}` shows the password page or the gallery as `spec/approvals-gallery.md` says, built from the token file and the components, under the nonce policy made in `proxy.ts`, working with JavaScript switched off; the screenshots exist.
- **New files:** `proxy.ts`; `app/l/[slug]/page.tsx`, `app/l/[slug]/error.tsx`, `app/not-found.tsx`, `app/global-error.tsx`; the body of `app/layout.tsx`; `src/ui/tokens.css`, `src/ui/format-date.ts`, `src/ui/group-signoffs.ts` and the component folders in "Components"; `test/ui.test.tsx`; `e2e/build.spec.ts`, `e2e/gallery.spec.ts`, `e2e/shots.spec.ts`.
- **May touch:** `next.config.ts` (only the settings in "Next.js settings"); `test/config.test.ts` (the import, `'use client'` and `dangerouslySetInnerHTML` rows); `vitest.config.ts` (`.tsx` tests); `playwright.config.ts`; root `eslint.config.js` (the file pattern for `approvals-service/**/*.tsx`).
- **Must not get wrong** (security review): `proxy.ts` deletes the visitor's own policy and `x-nonce` headers and does no session or limit work; the page never `notFound()`s or redirects a right-shape slug, never sets a cookie, and passes only the view to components; no client component but the two error boundaries; no third-party origin, font, image optimisation or telemetry; nothing about a link prerendered or cached.
- **Read:** `spec/approvals-gallery.md` (all); `spec/approvals-service.md` "The gallery view", "Notices", "Visitor routes and logic".
- **Check first:** in the built output under `next start`, that Next.js puts the nonce on every script and style tag it writes and that the page draws with no policy refusal; a refusal that needs a looser policy: stop and report; the architect rules.
- **Tests:** as named.
- **Shots:** `98-gallery-password`, `98-gallery-password-wrong`, `99-gallery`, `99-gallery-phone`, by `e2e/shots.spec.ts`, into the root `shots/` folder; named in the report.
- **Class:** S+W. Security class, full review (the session read on the page, the policy, the cookie path). **After:** AP-4.

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

- **Split [D-096].** The S3 part is **AP-10a (built)**: `s3-section/`, mounted in `settings-screen.tsx`, `tests/unit/renderer/screens/settings/s3-section.test.tsx`, shot `90-settings-cloud-storage` in `tests/shots/ap-10a.shots.ts`. As built: `spec/storage-and-publish.md` "Storage settings screen". The approvals part (`approvals-section/`, its test, shot `91`) stays here as AP-10 and waits for AP-6. "Test connection" for S3 is AP-10b.

- **Exists when done:** Settings has "Approvals service" as `spec/approvals.md` "Screens" says, mounted after "Cloud storage".
- **New files:** `src/renderer/screens/settings/approvals-section/`.
- **May touch:** `src/renderer/screens/settings/settings-screen/settings-screen.tsx` (the mount, a few lines).
- **Read:** `spec/approvals.md` "Settings", "Screens" (Settings); `spec/screens.md` "Rules for every screen"; `spec/storage-and-publish.md` "Amazon S3", "Storage settings screen".
- **Tests:** `tests/unit/renderer/screens/settings/approvals-section.test.tsx` (save sends `approvals.setService`; a refusal's sentence shown; Remove sends null; key saved with `secret.set` and shown by last four; Test connection shows "Connected." or the sentence; axe). Shots: `tests/shots/ap-10.shots.ts`: `91-settings-approvals-service` (with the stand-in, dev tools on).
- **Class:** D. Not security class. **After:** AP-6.

### AP-10b — Test connection for S3

- **Exists when done:** "Test connection" in Settings' Cloud storage proves the saved bucket, region and keys can list, write, read and delete inside the configured folder, as `spec/storage-and-publish.md` "Test connection (S3)" says.
- **New files:** `src/main/providers/s3/check-access.ts` (`checkS3Access`); `src/main/commands/storage/check-s3.ts`; `src/main/commands/storage/require-s3-settings.ts` (moved, not rewritten); `src/shared/schemas/commands/storage-check.ts` (input, reply, reasons and sentences); `src/renderer/screens/settings/s3-check/`.
- **May touch** (one line each unless named): `src/main/commands/storage/index.ts` (returns the command); `src/main/commands/agent-policy.ts` (the `deny` row); `src/main/commands/dev/storage.ts` (imports the moved guard); `src/renderer/screens/settings/s3-section/s3-section.tsx` (mounts `s3-check`, a few lines); the file that lists refusal reasons, if one does; `tests/unit/main/commands/agent-policy-table.test.ts` (the row); any test that lists command names; `tests/shots/ap-10a.shots.ts` (shot 90 retaken, now with the button).
- **Read:** `spec/storage-and-publish.md` "Storage interface", "Path rules", "Amazon S3" (all of it), "Storage settings screen"; `src/main/commands/comfy/check.ts` (the model for a check command).
- **Check first:** with recorded S3 replies, the error names the SDK gives for a wrong region (`PermanentRedirect`, `AuthorizationHeaderMalformed`, a 301) while `followRegionRedirects` is false. A name the table does not hold: report it; the architect rules.
- **Tests:** `tests/unit/main/providers/s3/check-access.test.ts` (a stand-in request handler under the real pin; one table: the four calls in order, every key under the folder's `adman-connection-check/`, the delete naming the written key only; each failure kind from a recorded reply; `AccessDenied` at each step names that permission; delete still sent after a failed read; a delete error in `Errors` and a thrown one; a host off the pin refused; neither key in any result or log detail); `tests/integration/commands/storage-check-s3.test.ts` (not set up; no keys `NEEDS_KEY`; the agent `AGENT_DENIED`; each kind's sentence; the reply holds no key, address or provider message); `tests/unit/renderer/screens/settings/s3-check.test.tsx` (disabled when not set up; "Testing…" while working; "Connected." line; a refusal's sentence; line cleared after a save; axe). No real bucket in any automatic test.
- **Hand check** (the stakeholder, after merge): the three in "Test connection (S3)", with his own bucket.
- **Class:** E + D. Security class, short review (the keys, the pinned host, writes and deletes only inside the folder). **After:** AP-5 and AP-7 merged (AP-5 owns `agent-policy.ts` until then; AP-7 edits `s3/`).

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
- **New files:** `tests/e2e/approvals.spec.ts` (offline, in `test:e2e`: the stand-in service and the test picture store; Settings, make link, update gallery, a sign-off planted in the stand-in, Refresh, the marks; an edit, "Changed since sign-off", update, the earlier-version line); `playwright.approvals.config.ts` and `tests/approvals-local/` (`global-setup.ts`: makes a temporary folder; runs `npm run db:migrate` in `approvals-service/` with `TURSO_DATABASE_URL=file:{folder}/local.db`; runs `npm run build` there; starts `npm run start -- -p {free port}` there with `API_KEY` (a value made for this run), the same `TURSO_DATABASE_URL`, `TEST_PICTURE_ORIGIN=http://127.0.0.1:{picture port}` and `NEXT_TELEMETRY_DISABLED=1` in its environment; starts a static server on the picture port for the app's test picture folder; waits for the health route; `approvals-local.spec.ts`: the flow in the exit criteria, the visitor in a Playwright Chromium page); `approvals-service/README.md` (the steps and values of `spec/approvals-service.md` "Deploying", word for word).
- **May touch:** root `package.json` (script `test:approvals-local`: `npm run build && playwright test --config playwright.approvals.config.ts`).
- **Read:** this file; `spec/approvals-service.md` "Running it locally", "Deploying", "Environment"; `spec/test-harnesses.md` "Offline end-to-end harness".
- **Check first:** that Chromium keeps the `__Host-` cookie from `http://127.0.0.1`; if not, the run uses `localhost` for the service and says so. If Playwright's Chromium is not installed, report it rather than download it unasked.
- **Tests:** the two specs. No CI workflow names `test:approvals-local`. No shots of its own (AP-16 made 98 and 99). The developer lists the stakeholder's hand checks, after deploying with the README: (1) one "Update gallery" to his real S3 bucket and one visitor sign-off through the deployed service, which also proves the form Origin check passes behind Vercel; (2) "Test connection" with his own bucket (AP-10b's hand check); (3) one right and one wrong password on the deployed service; (4) `curl -sI` on the password page and on a picture: the headers match `spec/approvals-gallery.md` and `spec/approvals-service.md`, with Vercel's own additions listed; (5) a preview address asks for Vercel sign-in while the production domain does not; (6) one picture larger than 4.5 MB loads (the stream); (7) Windows (D-087). The service's scripts set `NEXT_TELEMETRY_DISABLED=1` inline: fine on macOS and Linux, not in Windows `cmd`.
- **Class:** G + S. Security class, short review (the test doors are only test doors). **After:** every other AP slice.

## Left for later

In `spec/approvals.md`, "Left for later": video variants as stills, a picture store of the service's own, a job with progress for big galleries, links of deleted campaigns, MCP tools.
