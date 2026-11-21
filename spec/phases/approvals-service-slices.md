# Approvals by link: the service slices

The slices that build the approvals service in `approvals-service/`: AP-1, AP-2, AP-3, AP-14, AP-15, AP-4, AP-16, in that order. Rules, exit criteria and the wave table: `spec/phases/approvals.md`. Design: `spec/approvals-service.md`, `spec/approvals-service-data.md`, `spec/approvals-service-visitor.md`, `spec/approvals-service-tests.md`, `spec/approvals-gallery.md`.

### AP-1 — Service skeleton, contract, database (built)

Built on the earlier host (a Cloudflare Worker with D1, the Workers Vitest pool). Its Worker files (`wrangler.jsonc`, `src/index.ts`, the Workers test set-up) are removed or replaced by AP-14; its contract, database, crypto and route tables stay.

- **Exists when done:** `approvals-service/` installs, type-checks and tests on this machine; `wrangler.jsonc`, the D1 migration and its data-access functions exist; the router registers every route of the service spec against stub handlers (an API stub answers `404 not_found`, a visitor stub `404` "Not found."), and `GET /api/v1/health` works with the full key check; the contract exists in both places with the copy test; the password hash and the random letters work.
- **New files:** `approvals-service/package.json`, `tsconfig.json`, `wrangler.jsonc`, `vitest.config.ts`, `migrations/0001_init.sql`; `src/index.ts`, `app.ts`, `env.ts`, `contract.ts`; `src/api/auth.ts`, `body.ts`, `errors.ts`, `health.ts`; stubs `src/api/links.ts`, `gallery.ts`, `read.ts`, `src/visitor/routes.ts`; `src/crypto/random.ts`, `password.ts`, `compare.ts`; `src/db/links.ts`, `variants.ts`, `signoffs.ts`, `sessions.ts`; `test/setup.ts` and the tests below. Added as built: `src/api/route.ts`, `test/env.d.ts`, `test/tsconfig.json`, `test/routes.test.ts`. In the app: `src/shared/approvals/contract.ts`; `tests/unit/config/approvals-contract.test.ts`; `tests/unit/shared/approvals/contract-ids.test.ts`.
- **May touch:** `.gitignore` (it also ignores `approvals-service/worker-configuration.d.ts`), `eslint.config.js` (ignore lines only), `.prettierignore`.
- **Read:** `spec/approvals-service.md` "What it is", "Folder and tooling"; `spec/approvals-service-data.md` "The shared contract", "Database", "Random values and passwords", "The keyed API" (order of checks, error body); `spec/infra-and-settings.md` "Packages: licences and install scripts". **Check first** in Cloudflare's current docs: the Vitest plugin's setup (`cloudflareTest`, `readD1Migrations`, `applyD1Migrations`), the supported Vitest version, and the Workers types to use. Report each package's licence and every `allowScripts` entry.
- **Tests:** `test/contract.test.ts`, `test/random.test.ts`, `test/password.test.ts`, `test/api-auth.test.ts` (against health), `test/config.test.ts`, `test/worker.test.ts`, `test/db.test.ts` (each access function round trip; a link delete batch removes sessions, sign-offs and gallery rows of that link only). Root: the contract copy test; `contract-ids.test.ts` (200 IDs from the app's campaign and variant ID makers and from `ulid` pass the contract).
- **Class:** S + A. Security class, full review (the key check, the hash, the tooling). **After:** nothing.

### AP-2 — Service: link API (built)

- **Exists when done:** every `/api/v1/links` route answers as `spec/approvals-service-data.md` "The keyed API" says, with `checkPictureUrl` (the test origin included) guarding every picture address.
- **New files:** the bodies of `src/api/links.ts`, `gallery.ts`, `read.ts`; `src/pictures/check-url.ts`.
- **May touch:** `src/db/*.ts` (a query a route needs; no table change); `src/env.ts` (the `TEST_PICTURE_ORIGIN` check, written here, not in AP-1); `src/app.ts` (the two `check` lines).
- **Must not get wrong** (security review): replies are built field by field or through the reply schema, never from a database row (rows hold the hash, salt, internal ID and picture address); a new password is one batch with ending the link's sessions.
- **Read:** `spec/approvals-service-data.md` "The keyed API", "Database"; `spec/approvals-service-visitor.md` "Pictures" (`checkPictureUrl` only).
- **Tests:** `test/api-links.test.ts`, `test/picture-url.test.ts`.
- **Class:** S. Security class, full review. **After:** AP-1.

### AP-3 — Service: visitor logic and sessions (built)

- **As built** (on the earlier host, with its review's fixes): entering (`visitor/actions.ts` `enterLink`), the try limit (`throttle.ts`, `db/enter.ts`), sessions and the cookie (`session.ts`, with the session inserted only while the checked salt and hash are still the link's), the form checks (`forms.ts`), leaving, the narrowed `GalleryView` from `openGallery` (raw rows never leave the logic), the slug shape checked first, and the header sets (`headers.ts`). It also drew hand-written HTML pages (`html.ts`, `password-page.ts`, `gallery-page.ts`, `styles.ts`, `test/pages.test.ts`), which AP-15 removes in favour of the Next.js pages (D-097).
- **Tests as built:** `test/session.test.ts`, `test/throttle.test.ts`, `test/forms.test.ts`, `test/pages.test.ts`.
- **Class:** S. Security class, full review (done).

### AP-14 — Service: move to Next.js and libSQL (built, reviewed; review fixes in build)

- **Exists when done:** `approvals-service/` is a Next.js `16.4.6` app; every request goes through `app/[[...path]]/route.ts` to the unchanged `createApp`, so the keyed API, the visitor routes and the hand-written pages still answer exactly as before; the database is reached through `src/db/client.ts` over `@libsql/client`; every test from AP-1 to AP-3 passes in plain Node Vitest with the same assertions; `next build` and `next start` work, listening on `127.0.0.1` and tested at `localhost`; nothing of Wrangler or the Workers runtime is left.
- **New files:** `next.config.ts`, `playwright.config.ts`, `scripts/migrate.ts`, `app/[[...path]]/route.ts`, `app/layout.tsx` (the bare `<html>` and `<body>`, needed by `next build`; AP-16 fills it), `src/db/client.ts`, `src/server/env.ts`, `src/server/serve.ts`, `test/db.ts`, `test/empty.ts`, `test/db-client.test.ts`, `test/entry.test.ts` (replacing `test/worker.test.ts`), `e2e/api.spec.ts`.
- **Removes:** `wrangler.jsonc`, `src/index.ts`, `test/setup.ts`, `test/env.d.ts`, `test/worker.test.ts`; the packages `wrangler` and `@cloudflare/vitest-plugin`.
- **May touch:** `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `test/tsconfig.json`; `src/env.ts` and `src/db/*.ts`, `src/visitor/actions.ts`, `session.ts`, `throttle.ts` (type names only, `spec/approvals-service-data.md` "What changes in each file"); `src/crypto/compare.ts` (`node:crypto` `timingSafeEqual`); the `import 'server-only'` line in `src/db/`, `src/crypto/`, `src/pictures/`, `src/server/`; `test/api-helpers.ts`, `test/visitor-setup.ts` and every `test/*.test.ts` (harness lines only, the port table in `spec/approvals-service-tests.md`); `test/config.test.ts` (rewritten); root `.gitignore`, `eslint.config.js` (ignore lines), `.prettierignore`.
- **Must not get wrong** (security review): the key check's order, the 2 MiB and 8 KiB caps, every header set and every reply are byte-for-byte as before (the existing tests prove it, and they change only in harness lines); `timingSafeEqual` keeps the equal-length rule; `TEST_PICTURE_ORIGIN` is dropped whenever `VERCEL` is set; a missing database address means not set up; the migrate script refuses a hosted address without `--hosted`; no statement from the libSQL client leaks a row type past `client.ts`; the form Origin check is not loosened to make a local test pass.
- **Check first:** that `next build` accepts the root optional catch-all (`spec/approvals-service.md`, "How Next.js and the service code fit"; stop and report before using the fallback); that `@libsql/client` runs `:memory:` and `file:` with no network; the packages' licences and install scripts against the table in `spec/approvals-service.md` "Folder and tooling" (report every `allowScripts` entry).
- **Read:** `spec/approvals-service.md` "How Next.js and the service code fit", "Folder and tooling", "Environment", "Running it locally"; `spec/approvals-service-data.md` "Database" (all); `spec/approvals-service-tests.md` (the port, the Playwright set-up).
- **Tests:** every existing test file, ported; `test/db-client.test.ts`, `test/entry.test.ts`, `test/config.test.ts`; `e2e/api.spec.ts`. The report gives the test count per file before and after.
- **As built and reviewed:** on local `next start`, `request.url` is `http://localhost:{port}`, so every e2e base address uses `localhost`; Next.js answers a few requests itself before the router, none carrying data; `vary` and `content-encoding` are in the allowed header list and compression stays on; a client-sent `X-Forwarded-Proto: https` is honoured on local `next start` only (nuisance, noted); test files are exempt from the `process.env` rule. All in `spec/approvals-service.md`.
- **Review fixes (in build):** the migrate script prints a fixed line and an error's code or name only, never its message (`spec/approvals-service-data.md`, "Database"); the libSQL client is given Node's own `fetch` where that can be done cleanly; `next.config.ts` sets the project root (`spec/approvals-gallery.md`, "Next.js settings"); the licence table rows for `typescript`, `@playwright/test`, `caniuse-lite`, `lightningcss` and the `@img/sharp-*` packages.
- **Shots:** none.
- **Class:** S+W. Security class, full review (it touches reviewed code, the key check's path and the crypto). **After:** AP-2, AP-3 and its review fixes merged.

### AP-15 — Service: visitor replies for the page app

- **Exists when done:** the catch-all's visitor replies are only plain text, `303`s and (from AP-4) pictures: a failed entry is the one `303` to `/l/{slug}?m=wrong-password`; the `403` and `404` use the plain text headers; the notices table exists; `openGallery` takes `{ slug, cookie, m }` and `readSession` the cookie text; `pagePolicy(nonce)` and the page header set exist in `headers.ts`; the hand-written HTML is gone. Until AP-16, `GET /l/{slug}` answers the plain 404 (nothing is deployed in between).
- **New files:** `src/visitor/notices.ts`; `test/view.test.ts`, `test/headers.test.ts`.
- **Removes:** `src/visitor/html.ts`, `password-page.ts`, `gallery-page.ts`, `styles.ts`; `test/pages.test.ts`; the `gallery` and `stylesheet` rows of `VISITOR_ROUTES`.
- **May touch:** `src/visitor/routes.ts`, `actions.ts`, `session.ts`, `headers.ts`; `test/throttle.test.ts`, `test/session.test.ts`, `test/forms.test.ts`, `test/entry.test.ts`, `test/visitor-setup.ts` (the replies they expect).
- **Must not get wrong** (security review): the three entry failures stay byte-equal and the unknown slug still runs the dummy hash; the view keeps exactly its fields; `m` only through the table; every redirect a `303` from the checked slug; the cookie set and cleared only here.
- **Read:** `spec/approvals-service-visitor.md` "Visitor routes and logic" (all), "Headers on replies from the catch-all"; `spec/approvals-gallery.md` "The page policy and nonce".
- **Tests:** as named; the throttle test's byte-equal check now over the three `303`s.
- **Shots:** none.
- **Class:** S. Security class, full review. **After:** AP-14 and its review fixes.

### AP-4 — Service: sign-offs and pictures

- **Exists when done:** a visitor can sign off and remove a sign-off; the picture route passes on a picture fetched through `PictureSource` with every check, as a stream.
- **New files:** `src/visitor/signoffs.ts`, `picture-route.ts`; `src/pictures/source.ts`, `s3-source.ts`, `sniff.ts`; `e2e/pictures/` (two small PNG files and one JPEG made by the test, not downloaded).
- **May touch:** `src/visitor/routes.ts` (the three routes' lines); `src/app.ts` and `src/server/serve.ts` (the default `PictureSource` in `parts`); `src/db/signoffs.ts`, `variants.ts`; `playwright.config.ts` (the picture server in `globalSetup`); `test/forms.test.ts` (rows for the two sign-off routes).
- **Must not get wrong** (security review): the sign-off is the one conditional `INSERT … SELECT` from `gallery_variant` for this link and version; `checkPictureUrl` runs on the parsed `URL` right before the fetch and that same object is fetched; `redirect: 'manual'`; any non-200 fails; no visitor header passed on; the 16 MiB cap and the sniff before the first byte is sent; every failure a `404` with an empty body; the stored address never in a reply or log.
- **Read:** `spec/approvals-service-visitor.md` "Forms that write", "Pictures"; `spec/approvals-service.md` "Environment" (`TEST_PICTURE_ORIGIN`).
- **Tests:** `test/signoffs.test.ts`, `test/picture-route.test.ts` (with `s3-source` against a local Node server).
- **Shots:** none.
- **Class:** S+W. Security class, full review. **After:** AP-15.

### AP-16 — Gallery pages

- **Exists when done:** `GET /l/{slug}` shows the password page or the gallery as `spec/approvals-gallery.md` says, built from the token file and the components, under the nonce policy made in `proxy.ts`, working with JavaScript switched off; the screenshots exist.
- **New files:** `proxy.ts`; `app/l/[slug]/page.tsx`, `app/l/[slug]/error.tsx`, `app/not-found.tsx`, `app/global-error.tsx`; the body of `app/layout.tsx`; `src/ui/tokens.css`, `src/ui/format-date.ts`, `src/ui/group-signoffs.ts` and the component folders in "Components"; `test/ui.test.tsx`; `e2e/build.spec.ts`, `e2e/gallery.spec.ts`, `e2e/shots.spec.ts`.
- **May touch:** `next.config.ts` (only the settings in "Next.js settings"); `test/config.test.ts` (the import, `'use client'` and `dangerouslySetInnerHTML` rows); `vitest.config.ts` (`.tsx` tests); `playwright.config.ts`; root `eslint.config.js` (the file pattern for `approvals-service/**/*.tsx`).
- **Must not get wrong** (security review): `proxy.ts` deletes the visitor's own policy and `x-nonce` headers and does no session or limit work; the page never `notFound()`s or redirects a right-shape slug, never sets a cookie, and passes only the view to components; no client component but the two error boundaries; no third-party origin, font, image optimisation or telemetry; nothing about a link prerendered or cached; `e2e/gallery.spec.ts` and `e2e/shots.spec.ts` open every page at `http://localhost:{port}`, and nothing loosens the form Origin check.
- **Read:** `spec/approvals-gallery.md` (all); `spec/approvals-service-visitor.md` "The gallery view", "Notices", "Visitor routes and logic", "Forms that write".
- **Check first:** in the built output under `next start`, that Next.js puts the nonce on every script and style tag it writes and that the page draws with no policy refusal; a refusal that needs a looser policy: stop and report; the architect rules.
- **Tests:** as named.
- **Shots:** `98-gallery-password`, `98-gallery-password-wrong`, `99-gallery`, `99-gallery-phone`, by `e2e/shots.spec.ts`, into the root `shots/` folder; named in the report.
- **Class:** S+W. Security class, full review (the session read on the page, the policy, the cookie path). **After:** AP-4.
