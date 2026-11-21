# Approvals service: contract, database, passwords, keyed API

The data side of the approvals service [D-095, D-097]: the contract shared with the app, the database and its migrate script, random values and password hashing, and the keyed API the app calls. Read with `spec/approvals-service.md` (what the service is, how Next.js fits, tooling, environment, deploying), `spec/approvals-service-visitor.md` (the visitor's side) and `spec/approvals-service-tests.md`. Slices: `spec/phases/approvals-service-slices.md`.

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
| `PICTURE_URL` | At most 2,048 characters and a valid URL of any scheme. `checkPictureUrl` (`spec/approvals-service-visitor.md`, "Pictures") is the only guard on scheme and host |
| `TIME` | ISO 8601 UTC text with milliseconds and `Z` |

Request bodies are strict objects (an unknown key refuses the body). Reply schemas accept unknown keys and drop them.

## Database

**Schema Built; the libSQL client Built (AP-14).** Turso, a hosted SQLite-compatible database, reached with `@libsql/client` (D-097, A-102). `migrations/0001_init.sql` is unchanged: it was written for SQLite. Times are whole milliseconds since 1970 (UTC). No foreign keys: deletes are written out in one batch, children first (a batch is one transaction; a failure rolls the whole batch back).

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
- **What the migrate script prints.** A fixed line when it is done. On a failure, a fixed line and the error's code or name only, never its message: a database error's message can quote the database address and the token.
- **Its statement splitter** is safe for the one migration file, `0001_init.sql`. A later migration holding a trigger, or a `;` inside a comment, needs a better splitter first; the slice that adds such a file replaces it.

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
- **Node's own `fetch`.** `openDb` gives the libSQL client Node's own `fetch` where the client's options allow that cleanly; where they do not, the developer reports rather than patching the client. Being built (an AP-14 review fix).

**What changes in each file** (AP-14; nothing else in them):

| File | Change |
|---|---|
| `src/db/links.ts`, `variants.ts`, `signoffs.ts`, `sessions.ts`, `enter.ts` | `D1Database` becomes `Db`, `D1PreparedStatement` becomes `Statement`, imported from `./client`; `import 'server-only'` at the top |
| `src/env.ts` | `DB: D1Database` becomes `DB: Db` |
| `src/visitor/actions.ts`, `session.ts`, `throttle.ts` | `D1Database` becomes `Db` |
| `src/api/*.ts`, `src/app.ts` | None (they use `env.DB` and the statement calls above) |
| `src/crypto/compare.ts` | `crypto.subtle.timingSafeEqual` is a Workers addition that Node lacks; it becomes `timingSafeEqual` from `node:crypto` on `Uint8Array` views of the same buffers. Same rule: equal lengths only, never `===` on a secret |
| `src/crypto/*.ts`, `src/pictures/check-url.ts` | `import 'server-only'` at the top |

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
