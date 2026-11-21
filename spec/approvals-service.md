# Approvals service

The small web service behind approval links [D-095, D-097]: one Next.js app hosted on Vercel, with a Turso (libSQL, SQLite-compatible) database from the Vercel Marketplace. It serves the visitor's pages (password, gallery, sign-off) and a keyed API for the desktop app.

**State.** The logic of AP-1 to AP-3 is **Built** and reviewed: the contract, the database queries, the hash and random letters, the keyed API, `checkPictureUrl`, and the visitor logic (entering, the try limit, sessions, the cookie, the form checks, the narrowed gallery view). It was built on the earlier host (a Cloudflare Worker with D1, tested in the Workers Vitest pool). Moving it onto Next.js, the libSQL client and plain Node tests is AP-14, **Not built**. Everything else here is **Not built** unless marked (slices in `spec/phases/approvals.md`).

Read with `spec/approvals.md` (the desktop side, the security rules and threats, assumptions A-82 on) and `spec/approvals-gallery.md` (the pages: Next.js settings, the security headers, components, words, page tests).

## What it is

- One Next.js app, one database, one secret key. No other hosted product (no blob store, no cache store, no queue, no analytics).
- The desktop app is the only writer of links and galleries. It talks to the service over HTTPS with a secret key (`API_KEY`). It never reaches the database directly. It knows only the service address and the key, so the host does not matter to it.
- A visitor reaches the service with a link `{origin}/l/{slug}` and a password. After the password they see the campaign's variants and may add or remove a sign-off. They have no account.
- Pictures stay in the user's own S3 bucket. The app gives the service a signed read address for each picture; the service fetches the picture itself and passes it on only to a visitor who has entered the password. A visitor never sees the bucket address.
- **Nothing is deployed by an agent** (D-086). Agents build and test on this machine only, with a local database file or an in-memory one. No agent runs `vercel login`, `vercel link`, `vercel deploy`, `vercel env pull`, `vercel install`, any other command that contacts Vercel, or anything that contacts a hosted database (`npm run db:migrate -- --hosted` included). The Vercel command-line tool is not a dependency. The stakeholder deploys ("Deploying", below).

## How Next.js and the service code fit

Next.js owns two things: the page `GET /l/{slug}` (the password page or the gallery, `spec/approvals-gallery.md`) and the page nonce made in `proxy.ts`. **Every other request** goes through one route handler, `app/[[...path]]/route.ts`, which hands the `Request` unchanged to the existing `createApp(env, parts)`. So the keyed API, the visitor's form posts, the picture route, `robots.txt` and the plain 404 all keep the one reviewed router, with its order of checks, header sets and body caps.

```ts
// app/[[...path]]/route.ts (AP-14); every HTTP method, so Next.js answers none of its own
import { serve } from '../../src/server/serve'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const GET = serve
export const HEAD = serve
export const POST = serve
export const PUT = serve
export const DELETE = serve
export const PATCH = serve
export const OPTIONS = serve
```

- `src/server/serve.ts`: `serve(request) => createApp(loadEnv(), liveParts).fetch(request)`, where `liveParts = { now: () => Date.now(), random: cryptoBytes }` (AP-4 adds the picture source).
- Next.js picks the more exact route first, so `/l/{slug}` reaches the page and `/l/{slug}/enter` (two more parts) reaches the catch-all.
- **Why one catch-all and not one route file per path:** the route table stays in one place (`app.ts` and `visitor/routes.ts`), its tests keep calling `createApp` directly, and a path regex, not Next.js's percent-decoded `params`, still decides what a request is. **Check first** (AP-14): `next build` accepts a root optional catch-all beside `app/l/[slug]/page.tsx`. If it does not, the fallback is `app/api/v1/[[...path]]/route.ts` plus one route file per visitor path, each one line calling `serve`; the developer stops and reports before using it.
- **Runtime:** Node.js (`runtime = 'nodejs'`, the default). The Edge runtime is deprecated in Next.js 16 and gives nothing here.

### What Vercel and Next.js add or change in front

| Point | What happens | What keeps the rule |
|---|---|---|
| Request body limit | Vercel refuses a body over 4.5 MB with its own `413` before the code runs | The service's own caps (2 MiB API, 8 KiB forms) are below it and unchanged. A body over 4.5 MB gets Vercel's 413 even without a key: a refusal either way, accepted |
| Reply size limit | 4.5 MB for a reply that is not streamed | API replies stay far below. Pictures (up to 16 MiB) are sent as a stream ("Pictures") |
| `request.url` | Next.js builds it from the `Host` the browser used (Vercel: "the domain name as it was accessed by the client") and the protocol; locally `http://127.0.0.1:{port}/…` | See "Forms that write": the Origin check stays sound whatever the value, and fails closed if it is wrong |
| Trailing slash | Next.js would redirect `/api/v1/health/` with a 308 | `skipTrailingSlashRedirect: true` in `next.config.ts`; the router answers as before |
| `OPTIONS`, `HEAD` | Next.js answers them itself when a route does not export them | The catch-all exports every method |
| Headers added | Vercel adds `server`, `date`, `x-vercel-id`, `x-vercel-cache` and, on its domains, `strict-transport-security: max-age=63072000`; Next.js adds `x-powered-by` unless switched off | `poweredByHeader: false`. Vercel's headers carry no link data. `e2e/api.spec.ts` lists the full header set of `next start` replies; any header outside the expected set and the named allow-list (`date`, `connection`, `keep-alive`, `transfer-encoding`, `content-length`, `vary`) fails it. AP-13's hand check lists the deployed headers |
| Caching | Vercel's CDN caches a function reply only when told to (`s-maxage` or similar) | Every reply sets `Cache-Control: no-store`, except the picture (`private, max-age=300`) |

## Folder and tooling

```
approvals-service/
  package.json            own dependencies; "type": "module"; private; "engines": { "node": "24.x" }
  next.config.ts          "Next.js settings" in spec/approvals-gallery.md
  tsconfig.json           strict; DOM and JSX libs (for app/ and src/ui/); no path aliases
  next-env.d.ts           made by Next.js; ignored by git, eslint and Prettier
  vitest.config.ts        plain Node environment; aliases `server-only` to test/empty.ts
  playwright.config.ts    e2e against `next start` on 127.0.0.1 (below)
  proxy.ts                the page nonce and policy, for GET /l/{slug} only (spec/approvals-gallery.md)
  migrations/0001_init.sql
  scripts/migrate.ts      applies migrations/ in order; local file by default
  app/
    [[...path]]/route.ts  every request except the page, to createApp (above)
    layout.tsx, l/[slug]/page.tsx, not-found.tsx, error.tsx, global-error.tsx   (the pages)
  src/
    app.ts                createApp(env, parts, tables?): the router (Built)
    contract.ts           byte-equal copy of the app's src/shared/approvals/contract.ts (Built)
    env.ts                Env type; the API_KEY check; the TEST_PICTURE_ORIGIN check (Built)
    server/               env.ts (loadEnv), serve.ts (AP-14)
    api/                  auth.ts, body.ts, route.ts, health.ts, links.ts, gallery.ts, read.ts,
                          link-of.ts, errors.ts (Built)
    visitor/              routes.ts, actions.ts, headers.ts, forms.ts, session.ts, throttle.ts,
                          notices.ts (AP-15), signoffs.ts, picture-route.ts (AP-4)
    crypto/               random.ts, password.ts, compare.ts (Built)
    db/                   client.ts (AP-14), links.ts, variants.ts, signoffs.ts, sessions.ts, enter.ts
    pictures/             check-url.ts (Built); source.ts, s3-source.ts, sniff.ts (AP-4)
    ui/                   tokens.css and one folder per component (spec/approvals-gallery.md)
  test/                   Vitest; db.ts (a migrated in-memory database per test file); empty.ts;
                          one test file per area
  e2e/                    Playwright: api.spec.ts (AP-14); gallery.spec.ts, shots.spec.ts (AP-16)
  README.md               the deploy steps (AP-13)
```

- **Removed by AP-14:** `wrangler.jsonc`, `src/index.ts`, `test/setup.ts`, `test/env.d.ts`, `worker-configuration.d.ts` and every Wrangler and Workers package. **Removed by AP-15:** the hand-written HTML (`visitor/html.ts`, `password-page.ts`, `gallery-page.ts`, `styles.ts`) and `test/pages.test.ts`.
- **Code rules.** TypeScript, no semicolons, files aimed at 200 lines and never past 300, the same Prettier settings as the app. Root `npm run lint` covers this folder too (`.ts` and `.tsx`). The app's `npm run typecheck` and `npm test` do not include it; the folder has its own.
- **Server-only code.** Every file in `src/db/`, `src/crypto/`, `src/pictures/` and `src/server/` starts with `import 'server-only'`, so Next.js refuses to build if a page component pulls one into browser code. `test/config.test.ts` checks the line is there.
- **Packages** (every version pinned exactly; licences MIT unless named):

| Package | Version | Ships to the server | Install script | Notes |
|---|---|---|---|---|
| `next` | `16.4.6` | Yes | None | Its optional `sharp` is never used (`images.unoptimized`) |
| `react`, `react-dom` | `19.3.1` | Yes | None | The app's version |
| `@libsql/client` | `0.18.0` | Yes | None | Brings `libsql` `0.5.29` (MIT, no script) and its platform build (`@libsql/darwin-arm64` and others, MIT) |
| `zod` | `4.6.7` | Yes | None | Exactly the app's version (the root contract test checks) |
| `server-only` | `0.0.1` | Yes (an empty file on the server) | None | |
| `typescript` | `6.0.3` | No | None | |
| `vitest` | `5.1.1` | No | None | The app's version |
| `@playwright/test` | `1.65.1` | No | None | The app's version, so the browsers already installed for the app are used |
| `@types/node` | `24.10.1` | No | None | |
| `@types/react`, `@types/react-dom` | `19.3.0` | No | None | |

- **Install scripts.** The `allowScripts` list is replaced by: `"sharp@{the version npm resolves}": false`, `"fsevents@2.3.3": false`, and a `false` entry for any other package that asks. `sharp` (Apache-2.0; its `@img/sharp-libvips-*` parts are LGPL-3.0-or-later) is an optional dependency of `next` and is never loaded at run time, because image optimisation is off. If `next build` will not run without a script, the developer stops and reports.
- **Banned:** GPL and AGPL; any analytics, speed-insights or telemetry package; `@vercel/*` runtime packages; the `vercel` and `wrangler` tools. `test/config.test.ts` checks `package.json`.
- **No telemetry.** Every script that runs `next` sets `NEXT_TELEMETRY_DISABLED=1` inline (fine on macOS and Linux, not in Windows `cmd`).
- **Scripts.** `dev`: `NEXT_TELEMETRY_DISABLED=1 next dev -H 127.0.0.1 -p 3000`; `build`: `NEXT_TELEMETRY_DISABLED=1 next build`; `start`: `NEXT_TELEMETRY_DISABLED=1 next start -H 127.0.0.1`; `typecheck`: `tsc --noEmit -p tsconfig.json && tsc --noEmit -p test/tsconfig.json`; `test`: `vitest run`; `test:e2e`: `NEXT_TELEMETRY_DISABLED=1 playwright test`; `db:migrate`: `node scripts/migrate.ts`.
- **Root files** (AP-14): `.gitignore` swaps the Wrangler lines for `approvals-service/.next/`, `approvals-service/next-env.d.ts`, `approvals-service/.env*.local`, `approvals-service/*.db`, `approvals-service/test-results/`, `approvals-service/playwright-report/`; `eslint.config.js` and `.prettierignore` ignore `approvals-service/.next/`, `approvals-service/node_modules/` and `approvals-service/next-env.d.ts`.

## The shared contract

**Built.** The request and reply shapes are one Zod file, `src/shared/approvals/contract.ts`, owned by the app. The service keeps a byte-equal copy at `approvals-service/src/contract.ts`. Neither build pulls in the other's code: the app never imports from `approvals-service/`, and the service never imports from `src/`.

- The file imports only `zod` and exports only constants and schemas. It has no logic beyond schema refinements.
- `tests/unit/config/approvals-contract.test.ts` (root `npm test`) fails when the two files differ by one byte, or when the two `package.json` files name different `zod` versions.
- A change is made in the app's file and copied in the same commit.
- `CONTRACT_VERSION = 1`. The health reply carries it; the app refuses a service that answers another number ("The approvals service is a different version from this app."). The move to Next.js does not change it.

**ID and value rules in the contract** (the ID rules repeat the app's formats, `spec/data-model.md` "ID formats"; a root unit test makes 200 IDs with the app's own generators and checks each passes):

| Name | Rule |
|------|------|
| `PROJECT_ID` | ULID: `^[0-9A-HJKMNP-TV-Z]{26}$` |
| `CAMPAIGN_ID` | `^[a-z0-9-]{1,40}-[23456789abcdefghjkmnpqrstuvwxyz]{6}$` |
| `VARIANT_KEY` | The app's variant ID: `^[23456789abcdefghjkmnpqrstuvwxyz]{6}$` |
| `SLUG` | `^[0-9A-Za-z]{12}$` |
| `SIGNOFF_ID` | `^[0-9A-Za-z]{24}$` |
| `SHOWN_TEXT` | 1 to the field's length after the schema trims outer spaces (they are trimmed, not refused), no character of Unicode class Cc or Cf (no control and no direction-changing marks). `campaignName` and `title` 200, `sizeLine` 100 |
| `PASSWORD` | 12 to 128 characters as JavaScript counts string length, no character of class Cc |
| `EMAIL` | The schema trims and lower-cases it; then at most 254 characters, matching: `^[a-z0-9.!#$%&'*+/=?^_{}~-]{1,64}@[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$` (the backtick and the vertical bar, legal but rare, are left out). ASCII only, so no look-alike letters or direction marks reach a page (A-99) |
| `VERSION` | Whole number, 0 to 2^53 − 1 (the variant's `rev`) |
| `PICTURE_URL` | At most 2,048 characters and a valid URL of any scheme. `checkPictureUrl` (below) is the only guard on scheme and host |
| `TIME` | ISO 8601 UTC text with milliseconds and `Z` |

Request bodies are strict objects (an unknown key refuses the body). Reply schemas accept unknown keys and drop them.

## Database

**Schema Built; the libSQL client AP-14.** Turso, a hosted SQLite-compatible database, reached with `@libsql/client` (D-097, A-102). `migrations/0001_init.sql` is unchanged: it was written for SQLite. Times are whole milliseconds since 1970 (UTC). No foreign keys: deletes are written out in one batch, children first (a batch is one transaction; a failure rolls the whole batch back).

```sql
CREATE TABLE link (
  id                   TEXT PRIMARY KEY,      -- 24 letters, made by the service; never leaves it
  slug                 TEXT NOT NULL UNIQUE,  -- 12 letters, the visitor's address part
  project_id           TEXT NOT NULL,
  campaign_id          TEXT NOT NULL,
  campaign_name        TEXT NOT NULL,
  password_hash        TEXT NOT NULL,         -- base64 of 32 bytes
  password_salt        TEXT NOT NULL,         -- base64 of 16 bytes
  password_iterations  INTEGER NOT NULL,
  tries                INTEGER NOT NULL DEFAULT 0,
  tries_since          INTEGER,               -- start of the current 15-minute window
  created_at           INTEGER NOT NULL,
  UNIQUE (project_id, campaign_id)
);

CREATE TABLE gallery_variant (
  link_id             TEXT NOT NULL,
  variant_key         TEXT NOT NULL,
  position            INTEGER NOT NULL,       -- order in the gallery, from 0
  title               TEXT NOT NULL,
  size_line           TEXT NOT NULL,
  version             INTEGER NOT NULL,
  picture_url         TEXT NOT NULL,
  picture_expires_at  INTEGER NOT NULL,
  PRIMARY KEY (link_id, variant_key)
);

CREATE TABLE signoff (
  id           TEXT PRIMARY KEY,              -- 24 letters
  link_id      TEXT NOT NULL,
  variant_key  TEXT NOT NULL,
  version      INTEGER NOT NULL,
  email        TEXT NOT NULL,                 -- trimmed and lower-cased
  created_at   INTEGER NOT NULL,
  UNIQUE (link_id, variant_key, version, email)
);
CREATE INDEX signoff_link ON signoff (link_id);

CREATE TABLE session (
  token_hash  TEXT PRIMARY KEY,               -- SHA-256 of the cookie value, hex
  link_id     TEXT NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX session_link ON session (link_id);
```

- **Every query that reads a gallery, a sign-off, a session or a picture names the `link_id`** it got from the slug (visitor side) or from the project and campaign IDs (API side). No query takes a link, variant or sign-off from a form without that filter.
- **Why Turso and not Postgres (Neon).** Both are offered in the Vercel Marketplace. Turso speaks SQLite, so the migration and every reviewed query (`?` and `?1` placeholders, `UPDATE … RETURNING`, `INSERT … SELECT`) run unchanged, its `batch()` is one transaction like D1's, and tests run on an in-memory database inside plain Node Vitest with no network and no account. Postgres would mean rewriting each query and the migration, a second review of every query, and a local Postgres or an emulation for tests.
- **Migrations.** `scripts/migrate.ts` (plain TypeScript, run by Node 24's built-in type stripping) reads `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` from the process environment, makes `schema_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)` if missing, and applies each `migrations/*.sql` not yet recorded, in name order, each file and its record in one batch. It refuses any URL that is not `file:` or `:memory:` unless it is given `--hosted`. Only the stakeholder passes `--hosted`.

### The `Db` interface (`src/db/client.ts`, AP-14)

A thin layer with the same shape as the database calls the reviewed code makes, so the query files change only in type names:

```ts
export type Value = string | number | null
export type RunResult = { meta: { changes: number } }
export interface Statement {
  bind(...values: Value[]): Statement          // a new statement; the old one is unchanged
  first<T>(column?: string): Promise<T | null> // the first row as a plain object, or one column of it
  all<T>(): Promise<{ results: T[] }>
  run(): Promise<RunResult>
}
export interface Db {
  prepare(sql: string): Statement
  batch(statements: Statement[]): Promise<RunResult[]>  // one transaction, client.batch(…, 'write')
}
export function createDb(client: Client): Db
export function openDb(url: string, authToken?: string): Db  // createClient({ url, authToken, intMode: 'number' })
```

- Rows come back from libSQL as array-like objects; `createDb` turns each into a plain object of column name to value, so no libSQL type leaves this file.
- `intMode: 'number'`: every stored whole number is under 2^53, so `number` is exact.
- A statement from one `Db` is passed only to that `Db`'s `batch` (checked: a statement made by another `Db` throws).

**What changes in each file** (AP-14; nothing else in them):

| File | Change |
|---|---|
| `src/db/links.ts`, `variants.ts`, `signoffs.ts`, `sessions.ts`, `enter.ts` | `D1Database` becomes `Db`, `D1PreparedStatement` becomes `Statement`, imported from `./client`; `import 'server-only'` at the top |
| `src/env.ts` | `DB: D1Database` becomes `DB: Db` |
| `src/visitor/actions.ts`, `session.ts`, `throttle.ts` | `D1Database` becomes `Db` |
| `src/api/*.ts`, `src/app.ts` | None (they use `env.DB` and the statement calls above) |
| `src/crypto/compare.ts` | `crypto.subtle.timingSafeEqual` is a Workers addition that Node lacks; it becomes `timingSafeEqual` from `node:crypto` on `Uint8Array` views of the same buffers. Same rule: equal lengths only, never `===` on a secret |
| `src/crypto/*.ts`, `src/pictures/check-url.ts` | `import 'server-only'` at the top |

## Environment

**Not built (AP-14).** `src/server/env.ts` `loadEnv(): Env` reads the process environment on each request:

| Variable | Set by | Use |
|---|---|---|
| `API_KEY` | The stakeholder in Vercel (marked Sensitive, Production only); tests make a random one per run | The key check. Missing or under 32 characters: every API request gets `503 not_set_up` |
| `TURSO_DATABASE_URL` | The Turso integration, when the database is connected to the project; tests use `:memory:` or `file:{temporary folder}/e2e.db` | The database address. Missing: `loadEnv` treats `API_KEY` as missing too (the API answers `503 not_set_up`) and visitor routes answer the fixed `500` |
| `TURSO_AUTH_TOKEN` | The Turso integration | The database token; unset for local files |
| `TEST_PICTURE_ORIGIN` | Tests only | The test picture origin ("Pictures"). `loadEnv` drops it whenever `VERCEL` is set (Vercel sets `VERCEL=1` on every deployment, production and preview), so it can never take effect on a deployment; then `testPictureOriginOf` still accepts only exactly `http://127.0.0.1:{port}` |
| `VERCEL` | Vercel | Read only by the rule above |

- One database client per server instance, made on first use and kept (`openDb`), so warm requests reuse it.
- No variable is read anywhere else; `test/config.test.ts` fails if `process.env` appears outside `src/server/env.ts`, `scripts/migrate.ts`, `next.config.ts` and `playwright.config.ts`.
- **Web Crypto under Node.** `crypto.getRandomValues` and `crypto.subtle` (PBKDF2, SHA-256) are global in Node 24 and give the same results as before; the password tests prove it. Node sets no cap on PBKDF2 iterations, so the old "the local runtime does not enforce 100,000" gap is gone.

## Random values and passwords

**Built.** `src/crypto/`. Only `crypto.getRandomValues`, `crypto.subtle` and, for comparing, `node:crypto`'s `timingSafeEqual`.

- **Letters without bias.** `randomLetters(n)`: the 62-letter alphabet `0-9A-Za-z`. Draw random bytes; drop any byte of 248 or more (248 = 4 × 62); take `byte % 62` for each kept byte; draw again until there are `n`. Used for the slug (12), link IDs and sign-off IDs (24).
- **Slug clash.** The `UNIQUE` rule refuses a repeat; the service makes a new slug and tries again, at most 3 times, then answers 500. (62^12 is about 3 × 10^21, so a clash is not expected.)
- **Session token.** 32 random bytes, base64url without padding (43 characters).
- **Password hash.** PBKDF2 with HMAC-SHA-256, 100,000 iterations, a 16-byte random salt per link, 32 bytes out. The iteration count is stored per link so it can be raised later without breaking old links. A new password gets a new salt. If the hash fails, the code fails closed: an error reply, never a weaker hash or a skipped check.
- **Comparing.** Hashes and keys are compared timing-safe on equal-length buffers: for the key, the SHA-256 of each side; for the password, the two 32-byte hashes. Never `===` on a secret.
- **Unknown slug.** A password try for a slug that has no link runs the same PBKDF2 once against a fixed dummy salt, so the time taken does not tell a real slug from an unknown one. Too many tries does not run the hash (as built); it is told apart only by timing from "wrong password", and both get the same reply.

## The keyed API (the app's side)

**Built** (AP-1, AP-2); reached through the catch-all route from AP-14. Base path `/api/v1`. JSON in and out. Every reply carries `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`, and no CORS header.

**Order of checks for every API request** (`api/auth.ts`, `api/body.ts`):

1. A request with an `Origin` header is refused: `403 bad_request`. A browser page has no business here.
2. `API_KEY` missing or shorter than 32 characters: `503 not_set_up`.
3. `Authorization` must be exactly `Bearer {key}` and the key must match (timing-safe): else `401 bad_key`.
4. A body (POST, PUT) must have `Content-Type: application/json` and at most 2 MiB, read with a cap (a missing or false `Content-Length` does not get past it): else `415 bad_request` or `413 too_large`.
5. The path's IDs and the body pass the contract: else `400 invalid_input`, with no part of the input in the reply. Then the route's own `check`, if it has one (a rule the schema cannot make, such as `checkPictureUrl`), with its own refusal.
6. The handler. Unknown path: `404 not_found`, but only with the right key: steps 1 to 3 come first, so an unknown path under `/api/v1` without a key gets `401`.

**The route table** (`api/route.ts`, `app.ts`). Each route is `plainRoute({ name, method, path, handler })` or `bodyRoute({ name, method, path, body, check?, handler })`. A handler is an `ApiHandler<B>`; it gets `{ env, parts, link, body }` (`link` is the path's checked pair or null; `body` as its schema parsed it) and never the raw request. A thrown error is logged as the route name and the error's name, and answers `500 internal`. `test/routes.test.ts` fails if `replace-gallery` or `renew-pictures` has no `check`.

**Error body:** `{ "error": { "code": "...", "message": "..." } }`. `code` is one of `bad_request`, `not_set_up`, `bad_key`, `too_large`, `invalid_input`, `not_found`, `link_exists`, `internal`. The message is a fixed sentence per code; it never holds input, a stack or SQL text.

| Route | Body | Reply | Refusals besides the checks above |
|-------|------|-------|-----------------------------------|
| `GET /api/v1/health` | — | `200 { service: 'adman-approvals', contract: 1 }` | — |
| `POST /api/v1/links` | `CreateLink = { projectId, campaignId, campaignName, password }` | `201 { slug }` | `409 link_exists` when the pair already has a link |
| `GET /api/v1/links/{projectId}/{campaignId}` | — | `200 LinkState` (below) | `404 not_found` |
| `PUT /api/v1/links/{projectId}/{campaignId}/password` | `{ password }` | `200 {}`. New salt and hash; `tries` reset; **every session of the link deleted** | `404` |
| `PUT /api/v1/links/{projectId}/{campaignId}/gallery` | `Gallery = { campaignName, variants: GalleryVariant[] }`, 0 to 500, each `variantKey` once | `200 { variants: n }` | `404`; `400` for a repeated `variantKey` |
| `PUT /api/v1/links/{projectId}/{campaignId}/pictures` | `{ pictures: PictureRenewal[] }`, 1 to 500 | `200 { renewed: n }` | `404` |
| `DELETE /api/v1/links/{projectId}/{campaignId}` | — | `200 {}`. Deletes the link's sessions, sign-offs, gallery rows and the link, in one batch | `404` |

```ts
type GalleryVariant = {
  variantKey: string; title: string; sizeLine: string
  version: number; pictureUrl: string; pictureExpiresAt: string
}
type PictureRenewal = { variantKey: string; version: number; pictureUrl: string; pictureExpiresAt: string }
type LinkState = {
  slug: string
  campaignName: string
  createdAt: string
  variants: Array<{ variantKey: string; version: number; pictureExpiresAt: string }>
  signoffs: Array<{ id: string; variantKey: string; version: number; email: string; signedAt: string }>
}
```

- **Links are found by the project ID and campaign ID** in the path, never by a link ID the app holds. One link per pair.
- **Every `pictureUrl` is checked with `checkPictureUrl`** before anything is written. One bad address refuses the whole request (`400 invalid_input`).
- **Gallery replace** (one batch): `campaign_name` updated; each listed variant written (insert or replace) with its `position` from list order; every `gallery_variant` row of the link not in the list deleted, with every sign-off of that `variant_key`. Sign-offs of a listed variant are kept, whatever their version: a sign-off for an older version stays and is shown "for an earlier version".
- **Picture renewal** updates `picture_url` and `picture_expires_at` only for rows whose `variant_key` and `version` both match; others are skipped and not counted. It never changes a version.
- **`LinkState`** lists every sign-off of the link, oldest first, and every gallery row in gallery order. It holds no picture address, no password value or hash, and no session.

## Visitor routes and logic

The logic is **Built** (AP-3, with its review's fixes); the replies change in AP-15, sign-off and pictures are AP-4. The pages themselves are in `spec/approvals-gallery.md`. **The try limit, the session check and the form checks live only here**, never in `proxy.ts` or a page.

**Routes through the catch-all** (`visitor/routes.ts`; the table `VISITOR_ROUTES` of `{ name, method, path, handler }`, matched on the raw path of `request.url`, so a percent-encoded character never matches a slug):

| Route | What it does |
|-------|--------------|
| `POST /l/{slug}/enter` | Form `password`. Right: session made, cookie set, `303` to `/l/{slug}`. Wrong, unknown slug or too many tries: `303` to `/l/{slug}?m=wrong-password`, the same bytes in all three cases (A-103) |
| `POST /l/{slug}/signoffs` | Form `variant`, `version`, `email`. Adds a sign-off (AP-4). `303` to `/l/{slug}?m={code}#v-{variant}` |
| `POST /l/{slug}/signoffs/{id}/remove` | Removes that sign-off if it belongs to this link (AP-4). `303` as above |
| `POST /l/{slug}/leave` | Deletes this session's row, clears the cookie, `303` to `/l/{slug}`. No valid session: the `403` reply (as built) |
| `GET /l/{slug}/p/{variantKey}/{version}` | The picture, for a valid session only ("Pictures", AP-4) |
| `GET /robots.txt` | `User-agent: *` and `Disallow: /` |
| Anything else (not the page) | `404`, "Not found.", with the plain text headers below |

- Each handler call is wrapped: a throw logs the route name and the error's name only, and answers the fixed `500` "Something went wrong. Try again later." with the plain text headers.
- **Every redirect is a `303`** built by `headers.ts` from the checked slug (never Next.js's `redirect()`, which may send a 307 that makes the browser post again). Its headers are the plain text set plus `Location` and, when entering or leaving, `Set-Cookie`.
- **The cookie is set and cleared only here**, never by a page or by `proxy.ts`.

### Session

**Built.**

- **Cookie.** Name `__Host-adman-{slug}`; value the 43-character token; attributes exactly `Path=/; Max-Age=43200; HttpOnly; Secure; SameSite=Lax`, no `Domain`. `Secure` is kept on local runs too (`http://127.0.0.1` counts as a secure place in Chromium; AP-13 checks it). The `__Host-` prefix makes the browser refuse the cookie unless it is `Secure`, has `Path=/` and no `Domain`, so no other site or sub-domain can plant one. Each link has its own cookie name, so one link's session never opens another.
- **Row.** `session` holds the SHA-256 of the token, the link ID and the end time (12 hours). A stolen database copy holds no usable token.
- **Made only if the password is still the one checked.** One statement, in the batch with clearing the tries and deleting the link's expired sessions:

```sql
INSERT INTO session (token_hash, link_id, expires_at)
SELECT ?1, id, ?2 FROM link WHERE id = ?3 AND password_salt = ?4 AND password_hash = ?5
```

  When it inserts no row (the password was changed between the check and the insert), the reply is the same as a wrong password.
- **Check** (`visitor/session.ts`, every gallery, picture and form route): the slug has the `SLUG` shape (checked first, since Next.js hands page `params` over percent-decoded; a wrong shape counts as an unknown slug); the cookie of exactly that name; the value matches `^[A-Za-z0-9_-]{43}$`; its hash is a row with `expires_at` after now **and** `link_id` equal to the slug's link. Anything else is no session.
- **Ends** after 12 hours; on "Leave"; when the app sets a new password; when the link is deleted. On each successful password the link's expired session rows are deleted.

### The gallery view

**Built** (AP-3 review fix); its input changes in AP-15. `openGallery` gives `{ kind: 'password', notice }` or `{ kind: 'gallery', view }`, and the view is built field by field:

```ts
type GalleryView = {
  link: { slug: string; campaignName: string }
  variants: Array<{ variantKey: string; position: number; title: string; sizeLine: string; version: number; expired: boolean }>
  signoffs: Array<{ id: string; variantKey: string; version: number; email: string; createdAt: number }>
  notice: NoticeKey | null
}
```

- Raw rows (`LinkRow`, `VariantRow`, `SignoffRow`) never leave `src/visitor/` and `src/db/`. The view holds no hash, salt, internal link ID, picture address or expiry time. Only this type may be passed to a component; nothing under `app/` or `src/ui/` imports a row type or a module from `src/db/` or `src/crypto/` (`test/config.test.ts` checks the imports).
- **AP-15 changes the input** from a `Request` to what a page has: `openGallery(db, { slug, cookie, m }, now)`, where `cookie` is the `Cookie` header text or null and `m` the `m` query value or null. `readSession` takes the cookie text the same way.

### Wrong-password limit

**Built.** Guessing the password opens unreleased work, so this is in scope. A visitor locked out for a while is a nuisance and only noted.

- At most **10 password tries per link in 15 minutes**, counted before the hash is computed, in one atomic statement:

```sql
UPDATE link SET
  tries       = CASE WHEN tries_since IS NULL OR tries_since <= ?1 THEN 1 ELSE tries + 1 END,
  tries_since = CASE WHEN tries_since IS NULL OR tries_since <= ?1 THEN ?2 ELSE tries_since END
WHERE slug = ?3
RETURNING id, tries, password_hash, password_salt, password_iterations
-- ?1 = now - 15 minutes, ?2 = now
```

- `tries` over 10: refused without computing the hash, even for the right password. A right password resets `tries` to 0 and `tries_since` to null.
- **One reply for three cases:** unknown slug, wrong password, too many tries: the same `303` to `/l/{slug}?m=wrong-password`. A test compares the three replies byte for byte.
- Noted, not fixed (nuisance): anyone who has the link can lock real reviewers out for 15 minutes at a time.

### Forms that write

**Built.** Every `POST` under `/l/` passes `readForm` (`visitor/forms.ts`) before anything is read or written, in this order:

1. `Origin` is present and equal to the request's own origin (`new URL(request.url).origin`).
2. `Sec-Fetch-Site`, when present, is `same-origin`.
3. `Content-Type` is `application/x-www-form-urlencoded`; the body is at most 8 KiB.
4. A valid session for this slug (`/enter` excepted).

A failure gives `403`, plain text "This form could not be sent. Open the link again and try once more.", and nothing is written.

- **What stops a forged post from another site:** the `SameSite=Lax` cookie (a cross-site post carries no session) and the Origin and `Sec-Fetch-Site` checks. Not Next.js Server Actions: they post `multipart/form-data`, which `readForm` refuses, and the project uses none (`test/config.test.ts` fails on `'use server'`). Not a token: the three checks above already refuse every cross-site post, with nothing to keep.
- **Why the Origin check holds on Vercel.** `request.url` there is built from the host the browser used. A forged post comes from the visitor's own browser, which sets `Origin` to the other site and `Host` to ours, so the two never match. The check reads no `X-Forwarded-Host` itself and never loosens to make a mismatch pass. If `request.url` were ever wrong, every form would be refused: it fails closed, and `e2e/gallery.spec.ts` and AP-13's hand check prove the forms work.

**Sign off** (`visitor/signoffs.ts`, AP-4). `variant` must match `VARIANT_KEY`, `version` a whole number, `email` must pass `EMAIL` (else `m=bad-email`). Then one statement that writes only if the variant still exists for this link at this version:

```sql
INSERT OR IGNORE INTO signoff (id, link_id, variant_key, version, email, created_at)
SELECT ?1, link_id, variant_key, version, ?2, ?3
FROM gallery_variant WHERE link_id = ?4 AND variant_key = ?5 AND version = ?6
```

One row written: `m=signed`. None: if a sign-off with that link, variant, version and email exists, it was a repeat (`m=signed`); otherwise the variant changed or went (`m=changed`).

**Remove** (AP-4): `DELETE FROM signoff WHERE id = ? AND link_id = ?`. An ID of another link removes nothing. `m=removed` either way (anyone with the link may remove any sign-off [D-095]).

### Notices

**Not built (AP-15)**, `visitor/notices.ts`. `m` is looked up in this fixed table and becomes a `NoticeKey`; an unknown value is null. A page never shows text from the address.

| `m` | Shown on | Notice |
|-----|----------|--------|
| `wrong-password` | Password page | "That password did not work. If you have tried many times, wait 15 minutes and try again." |
| `signed` | Gallery | "Your sign-off was saved." |
| `removed` | Gallery | "The sign-off was removed." |
| `changed` | Gallery | "This variant changed while you were looking. Look at it again, and sign off if you still approve." |
| `bad-email` | Gallery | "Enter a full email address, like name@company.com." |

A key shown on the wrong page (for example `signed` on the password page) shows nothing.

### Headers on replies from the catch-all

`visitor/headers.ts` owns every visitor header set; the page set (with its nonce) is in `spec/approvals-gallery.md` and is made by a function in the same file. The plain text set, used by `robots.txt`, the `403`, the `404`, the `500` and every `303`:

```
Content-Type: text/plain; charset=utf-8
Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Cross-Origin-Opener-Policy: same-origin
Cache-Control: no-store
X-Robots-Tag: noindex, nofollow
Strict-Transport-Security: max-age=31536000        (only when the request is https)
```

`Referrer-Policy: no-referrer` keeps the slug from leaving in a `Referer` header. One test compares each header set whole.

## Pictures

**Not built (AP-4)** except `checkPictureUrl` (Built). `src/pictures/`. The service never stores picture bytes.

- **`PictureSource`** (`source.ts`) is the one interface the picture route uses: `get(ref: { url: string }): Promise<{ bytes: Uint8Array; type: 'image/png' | 'image/jpeg' } | null>`. `s3-source.ts` is today's only implementation.
- **`checkPictureUrl(text, env)`** (`check-url.ts`), used when the API stores an address and again right before every fetch:
  - `https:` only; no user name or password; no port, or port 443;
  - host, lower-cased, matching `^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]\.s3\.[a-z0-9-]+\.amazonaws\.com$` (a bucket's own host) or `^s3\.[a-z0-9-]+\.amazonaws\.com$` (path style), the two forms the app's S3 client makes (`spec/storage-and-publish.md`, "Allowed hosts");
  - **test origin:** only when the environment has `TEST_PICTURE_ORIGIN` (never on a Vercel deployment, "Environment") and that value is exactly `http://127.0.0.1:{port}`, an address with that exact origin is also allowed.
- **Fetching** (`s3-source.ts`): the stored text is parsed once into a `URL`; `checkPictureUrl` runs on it; the same `URL` object is fetched with `fetch(url, { redirect: 'manual' })` and no added header, no cookie and nothing from the visitor's request. Under Node a redirect comes back as its real 3xx status. Status must be 200: anything else is a failure. `Content-Length` over 16 MiB fails before reading; the body is read with a 16 MiB cap; the first bytes must be a PNG (`89 50 4E 47 0D 0A 1A 0A`) or a JPEG (`FF D8 FF`) (`sniff.ts`). The reply's own `Content-Type` is ignored.
- **The picture route.** Session check; the row `gallery_variant` for (this link, `variantKey`); `version` must equal the row's; `picture_expires_at` after now; then `PictureSource.get`. Any failure: `404` with an empty body and the plain text headers. Success: the checked bytes sent as a stream (a `ReadableStream` that hands over the buffer in 1 MiB pieces, so Vercel's 4.5 MB limit on whole replies does not apply; every check has passed before the first byte), with `Content-Type` from the sniff, `X-Content-Type-Options: nosniff`, `Cache-Control: private, max-age=300`, `Content-Security-Policy: default-src 'none'; sandbox`, `Cross-Origin-Resource-Policy: same-origin`, `Referrer-Policy: no-referrer`.
- **The stored address never appears** in a reply, a log line or an error.
- **An expired address.** Signed S3 addresses last at most 7 days. The app renews them when it refreshes (`spec/approvals.md`, "Refresh"). The gallery shows the expiry sentence for a row whose time has passed. A picture that fails before its time shows the browser's broken picture with its `alt` text; the next "Update gallery" fixes it.

## Logs

The service writes no log line of its own except one `console.error` per unexpected failure, holding the route name and the error's name only. Never a key, password, cookie, token, email, picture address, slug or request body. A page that fails logs the same way and then throws a fixed `PageFailed` error, so Next.js's own log line holds only that name and a trace through our code. Vercel's runtime logs show these lines; nothing else is sent anywhere.

## Tests

Everything runs on this machine. **Vitest** (`npm test`): plain Node, no network. **Playwright** (`npm run test:e2e`): `next build`, then `next start` on `127.0.0.1` with a local database file.

### The port (AP-14): same tests, same assertions, new harness

`test/db.ts` makes one in-memory database per test file (`openDb(':memory:')`; Vitest loads modules apart per file) and applies `migrations/*.sql` with the migrate function from `scripts/migrate.ts`. Files that change and how:

| File | Change |
|---|---|
| `vitest.config.ts` | No Cloudflare plugin; `environment: 'node'`; alias `server-only` → `test/empty.ts`; a random `API_KEY` per run in `test.env` |
| `test/setup.ts`, `test/env.d.ts` | Deleted (replaced by `test/db.ts`) |
| `test/tsconfig.json` | Node and Vitest types in place of the Workers types |
| `test/api-helpers.ts`, `test/visitor-setup.ts` | `import { env } from 'cloudflare:workers'` and `env.DB` become `import { db } from './db'` and `db` |
| Every test using `reply.json<T>()` (a Workers typing) | `(await reply.json()) as T` |
| Every other `test/*.test.ts` touching `env` | Builds its `Env` object with `db` |
| `test/config.test.ts` | Rewritten: checks `package.json` (pins, banned packages, telemetry off in scripts, `allowScripts`), `next.config.ts` settings, the `server-only` lines, imports under `app/` and `src/ui/`, `process.env` only in its four files, no `'use server'` |
| `test/worker.test.ts` | Becomes `test/entry.test.ts`: the catch-all's exported `GET` answers health with the key, `robots.txt`, and an unknown path with the plain 404; `loadEnv` drops `TEST_PICTURE_ORIGIN` when `VERCEL=1` and treats a missing database address as not set up |

Every other assertion stays as it was. The developer reports the count of tests per file before and after; only the two rewritten files may differ.

### Test files (all phases)

| File | What it proves |
|------|----------------|
| `test/contract.test.ts` | Each contract rule: good values, each bound, a control character, a direction mark, a non-ASCII email |
| `test/random.test.ts` | Letters only from the alphabet, the right length; with a fixed byte source, bytes 248 to 255 are skipped and 247 gives `z` |
| `test/password.test.ts` | Round trip; wrong password fails; the stored iteration count is used; a new password changes the salt |
| `test/db-client.test.ts` (AP-14) | `first` with and without a column; `all`; `run` counts changes; a failing statement rolls back the whole `batch`; `RETURNING` rows come back; a statement from another `Db` is refused |
| `test/api-auth.test.ts` | Table: no key, wrong key, a key one letter off, `API_KEY` unset or 31 characters (`503`), an `Origin` header with the right key (`403`), wrong content type, a 2 MiB + 1 body without `Content-Length`; none reaches a handler |
| `test/api-links.test.ts`, `test/api-isolation.test.ts` | Create, read, new password (sessions gone), gallery replace, renewal, delete; a path naming another campaign gets `404` |
| `test/picture-url.test.ts` | Table: both S3 host forms pass; `http:`, another host, `amazonaws.com.evil.example`, a port, user info, an IP address, the test origin without `TEST_PICTURE_ORIGIN`, a different test port; all refused |
| `test/session.test.ts` | Cookie attribute text exact; another link's cookie, a malformed or expired token, a wrong-shape slug: no session; "Leave" ends it; the token is not stored, its hash is; a password changed between check and insert makes no session and the wrong-password reply |
| `test/throttle.test.ts` | Ten wrong tries, then the right password is refused; after 15 minutes it works; the three failure replies are byte-equal `303`s |
| `test/forms.test.ts` | Table over every write route: no `Origin`, another `Origin`, `Sec-Fetch-Site: cross-site`, JSON or multipart content type, a 9 KiB body, no session: `403` and nothing written |
| `test/view.test.ts` (AP-15) | The view holds exactly the listed fields (a link row with a hash, salt and picture address planted: none of them anywhere in the serialised view); notices from the table only; an unknown `m` is null |
| `test/signoffs.test.ts` (AP-4) | Sign off, repeat adds nothing, old version gives `m=changed`, a variant removed between page and post writes nothing, bad email gives `m=bad-email`, removing another link's sign-off removes nothing |
| `test/picture-route.test.ts` (AP-4) | No session `404`; a session of another link `404`; wrong version `404`; expired `404`; a stand-in source giving a redirect, 403, 17 MiB, or HTML bytes: `404` with an empty body; a PNG passes with the exact headers as a stream; `s3-source` against a local Node server: a 302 is not followed, no visitor header arrives |
| `test/headers.test.ts` (AP-15) | Every header set whole: plain text, `303`, page (with a fixed nonce), picture |
| `test/config.test.ts`, `test/routes.test.ts`, `test/db.test.ts`, `test/entry.test.ts` | As above and as built |
| `e2e/api.spec.ts` (AP-14) | Against `next start`: health with the key; `401` without; the full reply header list; a trailing slash answered by the router, not a redirect |
| `e2e/gallery.spec.ts`, `e2e/shots.spec.ts` (AP-16) | `spec/approvals-gallery.md`, "Tests" |

### Playwright set-up (AP-14)

`playwright.config.ts`: `globalSetup` makes a temporary folder, runs the migrations on `file:{folder}/e2e.db`, makes a random `API_KEY`, and (from AP-4) starts a static server on a free `127.0.0.1` port serving `e2e/pictures/`; `webServer` runs `npm run build` then `npm run start -- -p {free port}` with `API_KEY`, `TURSO_DATABASE_URL=file:{folder}/e2e.db`, `TEST_PICTURE_ORIGIN=http://127.0.0.1:{picture port}` and `NEXT_TELEMETRY_DISABLED=1` in its environment, and waits for `/robots.txt`. Tests seed links through the keyed API, as the app would, and plant sign-offs through the API's own database file only where a case needs it. Only Chromium is used; if it is not installed, the developer reports rather than downloads it.

## Running it locally

- `npm run dev` in `approvals-service/`: `next dev` on `127.0.0.1:3000`. Next.js reads local values from `approvals-service/.env.local`, which git ignores; the developer makes a random `API_KEY` there and a `TURSO_DATABASE_URL` of `file:local.db`, never prints the key, and runs `npm run db:migrate` once. Development mode loosens the page policy (`spec/approvals-gallery.md`), so tests and shots use `next start`.
- `next start` serves plain `http` on `127.0.0.1`. Browsers count `127.0.0.1` as a secure place, so the `Secure` cookie works there; AP-13 confirms this in a real browser and switches to `localhost` if it does not.

## Deploying

The stakeholder's steps, written into `approvals-service/README.md` by AP-13. No value is written in the repository; the stakeholder supplies each one.

1. **Project.** In Vercel, add a new project from this repository (or run `npx vercel` yourself in `approvals-service/`). Framework: Next.js. **Root Directory: `approvals-service`.** Node.js version: 24.x.
2. **Database.** Project, Storage: add Turso from the Marketplace, create a database, and connect it to the project for **Production only**. This sets `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. Choose the database region nearest the function region (step 3).
3. **Region.** Project Settings, Functions: set the function region to the one nearest your reviewers and the same as (or nearest to) the database.
4. **Key.** Make a long random key (at least 32 characters; for example `openssl rand -base64 48`). Project Settings, Environment Variables: add `API_KEY` with that value, marked Sensitive, for Production only. Keep it for step 9. Never add `TEST_PICTURE_ORIGIN`.
5. **Migration.** On your machine, in `approvals-service/`, with the two Turso values from the Vercel Storage tab typed into the shell (not saved into any file in the repository): `TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… npm run db:migrate -- --hosted`. Run it again after any later migration is added.
6. **Deployment Protection.** Project Settings, Deployment Protection: **Standard Protection** with Vercel Authentication. Previews and deployment addresses stay private; the production domain stays public, so visitors can open links. Not "All Deployments": that would block every visitor.
7. **Nothing extra on the pages.** Leave Web Analytics and Speed Insights off, and do not add their packages: they add scripts the page policy blocks and send visitor data to a third party. Leave the Vercel Toolbar off for production.
8. **Deploy** (push to the production branch, or Deploy in the dashboard). The production domain (`{project}.vercel.app`, or a custom domain added in Project Settings, Domains) is the service address. Never give the app a deployment address or a preview address.
9. In the app: Settings, "Approvals service": the address and the key, then "Test connection".
10. In the app: Settings, "Cloud storage": the S3 bucket, region and keys (the same ones publishing uses).

To change the key later: replace `API_KEY` in Vercel and redeploy, then put the new key in the app. Every session and link stays as it was.

**Values the stakeholder supplies:** the Vercel account and project; the Turso database (made through Vercel); the `API_KEY` value; the service address. **What the stakeholder creates on Vercel:** the project (root `approvals-service`), the Turso database connected to it, the `API_KEY` variable, the function region, the Deployment Protection setting, and optionally a custom domain.
