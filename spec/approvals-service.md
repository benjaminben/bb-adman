# Approvals service

The small web service behind approval links [D-095]: a Cloudflare Worker with a D1 database. It serves the visitor pages (password, gallery, sign-off) and a keyed API for the desktop app. AP-1's parts are **built** (folder and tooling, contract, database, the route tables with stubs, health with the key check, the hash and random letters); the rest is **Not built** (AP-2 to AP-4 and AP-13 in `spec/phases/approvals.md`).

Read with `spec/approvals.md`: the desktop side, the security rules and threats, and the assumptions (A-82 on). This file says what the service does; that file says why some choices were made.

## What it is

- One Worker, one D1 database, one secret. No other Cloudflare product (no R2, KV, Durable Objects, queues).
- The desktop app is its only writer of links and galleries. It talks to the service over HTTPS with a secret key (`API_KEY`). It never reaches the database directly.
- A visitor reaches the service with a link `{origin}/l/{slug}` and a password. After the password they see the campaign's variants and may add or remove a sign-off. They have no account.
- Pictures stay in the user's own S3 bucket. The app gives the service a signed read address for each picture; the service fetches the picture itself and passes it on only to a visitor who has entered the password. A visitor never sees the bucket address.
- **Nothing is deployed by an agent** (D-086). Agents build and test the service on this machine only: the Workers Vitest plugin and `wrangler dev` in its default local mode. No agent runs `wrangler login`, `wrangler deploy`, `wrangler secret put`, or any `--remote` command, and no test contacts a deployed service. The stakeholder deploys it ("Deploying", below).

## Folder and tooling

```
approvals-service/
  package.json          own dependencies; "type": "module"; private
  tsconfig.json         strict, like the app's; types from worker-configuration.d.ts; no DOM lib
  wrangler.jsonc        name, main, compatibility_date, the D1 binding "DB", send_metrics false
  vitest.config.ts      the Cloudflare Vitest plugin; the migrations as the TEST_MIGRATIONS
                        binding; a random API_KEY made per run
  migrations/0001_init.sql
  src/
    index.ts            export default { fetch }: builds the app from env and hands over the request
    app.ts              createApp(env, parts, tables?): the router; parts = { now, random } (AP-4 adds
                        pictures) so tests swap them; tables lets a test supply its own routes
    contract.ts         byte-equal copy of the app's src/shared/approvals/contract.ts
    env.ts              Env type; the API_KEY check; AP-2 adds the TEST_PICTURE_ORIGIN check
    api/                auth.ts, body.ts, route.ts, health.ts, links.ts, gallery.ts, read.ts, errors.ts
    visitor/            routes.ts, password-page.ts, gallery-page.ts, html.ts, styles.ts,
                        headers.ts, forms.ts, session.ts, throttle.ts, signoffs.ts, picture-route.ts
    crypto/             random.ts, password.ts, compare.ts
    db/                 links.ts, variants.ts, signoffs.ts, sessions.ts
    pictures/           source.ts (the PictureSource interface), s3-source.ts, check-url.ts, sniff.ts
  test/                 setup.ts (applies the migrations); env.d.ts (the test-only bindings);
                        tsconfig.json (test types); one test file per area
  README.md             the deploy steps (written by AP-13)
```

- **Code rules.** TypeScript, no semicolons, files aimed at 200 lines and never past 300, the same Prettier settings as the app. Root `npm run lint` covers this folder too (one style). The app's `npm run typecheck` and `npm test` do not include it; the folder has its own `npm run typecheck` and `npm test`.
- **Packages.** `wrangler`, `@cloudflare/vitest-plugin` (it replaced `@cloudflare/vitest-pool-workers`), `vitest` 5 (the plugin accepts it), `typescript`, and `zod` at exactly the app's version (`4.6.7` today). Every version is pinned exactly. `zod` is the only runtime package. Allowed licences: MIT, ISC, BSD, Apache-2.0 and similar; the project bans GPL and AGPL only. `@img/sharp-libvips-*` (LGPL-3.0-or-later) arrive through the local test runtime only and are never shipped; the security review agreed.
- **Worker types** are made by `wrangler types` into `worker-configuration.d.ts`, not taken from a types package. Git, eslint and Prettier ignore that file; `npm run typecheck` runs `npm run types` first. The tests' types (`cloudflare:test`, the plugin's types) sit in `test/tsconfig.json`.
- **Install scripts.** The service's `package.json` has its own `allowScripts` list under the app's rule (`spec/infra-and-settings.md`, "Packages"): every package that asks gets a pinned `false` entry. If `workerd` or `esbuild` will not run without its script, the developer stops and reports; the architect rules.
- **No telemetry.** `wrangler.jsonc` sets `"send_metrics": false`, and every script that runs `wrangler` sets `WRANGLER_SEND_METRICS=false`. The scripts set it inline, which works on macOS and Linux, not in Windows `cmd`.
- **Root files the service needs** (AP-1): `.gitignore` gains `approvals-service/.wrangler/`, `approvals-service/.dev.vars*` and `approvals-service/worker-configuration.d.ts`; `eslint.config.js` and `.prettierignore` ignore `approvals-service/.wrangler/`, `approvals-service/node_modules/` and `approvals-service/worker-configuration.d.ts`.
- **`wrangler.jsonc`** holds no key, no address and no account value. The D1 binding has `"binding": "DB"`, `"database_name": "adman-approvals"`, `"migrations_dir": "migrations"`, and a `database_id` of all zeros (`00000000-0000-0000-0000-000000000000`) that the stakeholder replaces when deploying. `vars` is empty: `API_KEY` is a secret and `TEST_PICTURE_ORIGIN` is never set here (a test reads the file and checks both).

## The shared contract

The request and reply shapes are one Zod file, `src/shared/approvals/contract.ts`, owned by the app. The service keeps a byte-equal copy at `approvals-service/src/contract.ts`. Neither build pulls in the other's code: the app never imports from `approvals-service/`, and the service never imports from `src/`.

- The file imports only `zod` and exports only constants and schemas. It has no logic beyond schema refinements.
- `tests/unit/config/approvals-contract.test.ts` (root `npm test`) fails when the two files differ by one byte, or when the two `package.json` files name different `zod` versions.
- A change is made in the app's file and copied in the same commit.
- `CONTRACT_VERSION = 1`. The health reply carries it; the app refuses a service that answers another number ("The approvals service is a different version from this app.").

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

## Database (D1)

`migrations/0001_init.sql`. Times are whole milliseconds since 1970 (UTC). No foreign keys: deletes are written out in one `batch()`, children first (a batch is one transaction; a failure rolls the whole batch back).

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
- D1 limits that matter (Cloudflare docs, checked 2026-11): 100 bound values per statement, 100 KB per statement, 2 MB per row, a `batch()` counts as one query. A gallery of 500 variants is one batch of about 1,000 statements, each well inside the limits.
- Migrations are applied with `wrangler d1 migrations apply`, which records them in the `d1_migrations` table. In tests, `readD1Migrations` (from the plugin, in `vitest.config.ts`) reads them into the `TEST_MIGRATIONS` binding, and `applyD1Migrations` (from `cloudflare:test`, in the setup file) applies them. Storage is kept apart per test file.

## Random values and passwords

`src/crypto/`. Only `crypto.getRandomValues` and `crypto.subtle` (Web Crypto, built into Workers).

- **Letters without bias.** `randomLetters(n)`: the 62-letter alphabet `0-9A-Za-z`. Draw random bytes; drop any byte of 248 or more (248 = 4 × 62); take `byte % 62` for each kept byte; draw again until there are `n`. Used for the slug (12), link IDs and sign-off IDs (24).
- **Slug clash.** The `UNIQUE` rule refuses a repeat; the service makes a new slug and tries again, at most 3 times, then answers 500. (62^12 is about 3 × 10^21, so a clash is not expected.)
- **Session token.** 32 random bytes, base64url without padding (43 characters).
- **Password hash.** PBKDF2 with HMAC-SHA-256, 100,000 iterations (the most Workers allows), a 16-byte random salt per link, 32 bytes out. The iteration count is stored per link so it can be raised later without breaking old links. A new password gets a new salt. The local runtime does not enforce the 100,000 cap, so local tests cannot prove it; AP-13's hand checks prove it after deploying. If the deployed runtime refuses the hash, the code fails closed: an error reply, never a weaker hash or a skipped check.
- **Comparing.** Hashes and keys are compared with `crypto.subtle.timingSafeEqual` on equal-length buffers: for the key, the SHA-256 of each side; for the password, the two 32-byte hashes. Never `===` on a secret.
- **Unknown slug.** A password try for a slug that has no link runs the same PBKDF2 once against a fixed dummy salt, so the time taken does not tell a real slug from an unknown one.

## The keyed API (the app's side)

Base path `/api/v1`. JSON in and out. Every reply carries `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`, and no CORS header.

**Order of checks for every API request** (`api/auth.ts`, `api/body.ts`):

1. A request with an `Origin` header is refused: `403 bad_request`. A browser page has no business here.
2. `API_KEY` missing or shorter than 32 characters in the Worker's environment: `503 not_set_up`.
3. `Authorization` must be exactly `Bearer {key}` and the key must match (timing-safe): else `401 bad_key`.
4. A body (POST, PUT) must have `Content-Type: application/json` and at most 2 MiB, read with a cap (a missing or false `Content-Length` does not get past it): else `415 bad_request` or `413 too_large`.
5. The path's IDs and the body pass the contract: else `400 invalid_input`, with no part of the input in the reply. Then the route's own `check`, if it has one (a rule the schema cannot make, such as `checkPictureUrl`), with its own refusal.
6. The handler. Unknown path: `404 not_found`, but only with the right key: steps 1 to 3 come first, so an unknown path under `/api/v1` without a key gets `401`.

**The route table** (`api/route.ts`, `app.ts`, built in AP-1). Each route is `plainRoute({ name, method, path, handler })` or `bodyRoute({ name, method, path, body, check?, handler })`. A handler is an `ApiHandler<B>`; it gets `{ env, parts, link, body }` (`link` is the path's checked pair or null; `body` as its schema parsed it) and never the raw request. Every stub handler is `notBuilt` (`404 not_found`). A thrown error is logged as the route name and the error's name, and answers `500 internal`. `test/routes.test.ts` fails if `replace-gallery` or `renew-pictures` has a real handler and no `check`.

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
- **Every `pictureUrl` is checked with `checkPictureUrl`** (below) before anything is written. One bad address refuses the whole request (`400 invalid_input`).
- **Gallery replace** (one batch): `campaign_name` updated; each listed variant written (insert or replace) with its `position` from list order; every `gallery_variant` row of the link not in the list deleted, with every sign-off of that `variant_key`. Sign-offs of a listed variant are kept, whatever their version: a sign-off for an older version stays and is shown "for an earlier version".
- **Picture renewal** updates `picture_url` and `picture_expires_at` only for rows whose `variant_key` and `version` both match; others are skipped and not counted. It never changes a version.
- **`LinkState`** lists every sign-off of the link, oldest first, and every gallery row in gallery order. It holds no picture address, no password value or hash, and no session.

## Visitor pages

All pages are built on the server as plain HTML with one stylesheet served by the Worker. **No script at all**: every action is a plain form `POST` followed by a `303` redirect back to the gallery (A-88).

| Route | What it does |
|-------|--------------|
| `GET /l/{slug}` | With a valid session for this link: the gallery. Otherwise: the password page. A slug of the right shape that has no link also gets the password page, the same bytes. |
| `POST /l/{slug}/enter` | Form `password`. Right: session made, cookie set, `303` to `/l/{slug}`. Wrong, unknown slug or too many tries: the password page with the one failure sentence, status 200, the same bytes in all three cases. |
| `POST /l/{slug}/signoffs` | Form `variant`, `version`, `email`. Adds a sign-off. `303` to `/l/{slug}?m={code}#v-{variant}` |
| `POST /l/{slug}/signoffs/{id}/remove` | Removes that sign-off if it belongs to this link. `303` as above |
| `POST /l/{slug}/leave` | Deletes this session's row, clears the cookie, `303` to `/l/{slug}` |
| `GET /l/{slug}/p/{variantKey}/{version}` | The picture of that variant, for a valid session only ("Pictures", below) |
| `GET /gallery.css` | The one stylesheet, a fixed text in `visitor/styles.ts` |
| `GET /robots.txt` | `User-agent: *` and `Disallow: /` |
| Anything else, or a slug of the wrong shape | `404`, `text/plain`, "Not found." |

**The visitor router** (`visitor/routes.ts`, built in AP-1). `VISITOR_ROUTES` is the exported table of `{ name, method, path, handler }`; a handler gets `{ request, env, parts, params }`. Each handler call is wrapped: a throw logs the route name and the error's name only, and answers a fixed plain-text `500` ("Something went wrong. Try again later.") with the page headers. AP-3 moves that reply onto its header helper, which adds HSTS.

### Session

- **Cookie.** Name `__Host-adman-{slug}`; value the 43-character token; attributes exactly `Path=/; Max-Age=43200; HttpOnly; Secure; SameSite=Lax`. The `__Host-` prefix makes the browser refuse the cookie unless it is `Secure`, has `Path=/` and no `Domain`, so no other site or sub-domain can plant one. Each link has its own cookie name, so one link's session never opens another.
- **Row.** `session` holds the SHA-256 of the token, the link ID and the end time (12 hours). A stolen database copy holds no usable token.
- **Check** (`visitor/session.ts`, every gallery, picture and form route): the cookie of exactly that name; the value matches `^[A-Za-z0-9_-]{43}$`; its hash is a row with `expires_at` after now **and** `link_id` equal to the slug's link. Anything else is no session.
- **Ends** after 12 hours; on "Leave"; when the app sets a new password; when the link is deleted. On each successful password the link's expired session rows are deleted.

### Wrong-password limit

Guessing the password opens unreleased work, so this is in scope. A visitor locked out for a while is a nuisance and only noted.

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
- **One reply for three cases:** unknown slug, wrong password, too many tries. The password page with "That password did not work. If you have tried many times, wait 15 minutes and try again." A test compares the three replies byte for byte.
- Noted, not fixed (nuisance): anyone who has the link can lock real reviewers out for 15 minutes at a time.

### Forms that write

Every `POST` under `/l/` passes these checks, in this order, before anything is read or written (`visitor/forms.ts`):

1. `Origin` is present and equal to the request's own origin (`new URL(request.url).origin`).
2. `Sec-Fetch-Site`, when present, is `same-origin`.
3. `Content-Type` is `application/x-www-form-urlencoded`; the body is at most 8 KiB.
4. A valid session for this slug (`/enter` excepted).

A failure gives `403` and a small page: "This form could not be sent. Open the link again and try once more." Nothing is written. With the `SameSite=Lax` cookie, this stops another site from sending a form on a visitor's behalf.

**Sign off** (`visitor/signoffs.ts`): `variant` must be a row of this link's gallery; `version` must equal that row's current version, else nothing is written and the redirect carries `m=changed`; `email` must pass `EMAIL`, else `m=bad-email`. A repeat of the same email for the same variant and version adds nothing. Success: `m=signed`.

**Remove:** `DELETE FROM signoff WHERE id = ? AND link_id = ?`. An ID of another link removes nothing. `m=removed` either way (anyone with the link may remove any sign-off [D-095]).

**Notices.** `m` is looked up in a fixed table; an unknown value shows nothing. The page never repeats text from the address.

| `m` | Notice |
|-----|--------|
| `signed` | "Your sign-off was saved." |
| `removed` | "The sign-off was removed." |
| `changed` | "This variant changed while you were looking. Look at it again, and sign off if you still approve." |
| `bad-email` | "Enter a full email address, like name@company.com." |

### The pages

- **Password page.** Heading "Review campaign". Text "Enter the password you were given." One password field (`autocomplete="current-password"`), button "Open". No campaign name, since the visitor has not proven anything yet.
- **Gallery page.** Heading: the campaign name. Under it: "Sign off on a variant by entering your email address. Anyone with this link can see who signed off, and can remove a sign-off." and a "Leave" button. Then one card per variant in gallery order, laid out with `grid-template-columns: repeat(auto-fill, minmax(260px, 1fr))` so it holds one variant or hundreds:
  - The picture (`<img loading="lazy" alt="{title}">`, `src` `/l/{slug}/p/{variantKey}/{version}`), or, when `picture_expires_at` is past, a grey box with "This picture has expired. Ask the person who sent the link to update the gallery."
  - The title and the size line.
  - "Signed off by": each sign-off for the current version, as `{email} · {date}` with a "Remove" button. None: "No sign-offs yet."
  - "For an earlier version": each older sign-off the same way, muted. Left out when there are none.
  - A form: email field (`type="email"`, `autocomplete="email"`) and button "Sign off".
  - The card's `id` is `v-{variantKey}`.
- **A gallery with no variants:** "Nothing to review yet."
- **Dates** are written `YYYY-MM-DD HH:MM UTC`.

### Escaping

Every value from outside the page's own code is escaped: the campaign name, titles and size lines (from the app), emails (from visitors), the slug and IDs.

- One tagged template, `html\`...\`` in `visitor/html.ts`, escapes every value put into it (`&`, `<`, `>`, `"`, `'`). Nested `html` results are kept as they are. A plain string is never joined into HTML outside it; review checks for `+` and `.join` on page text.
- Every attribute value is in double quotes. No value goes into a `style`, an event attribute, a `<script>` or a URL scheme position. The picture `src` and form `action` are built only from a checked slug, variant key and whole number.
- Escaping holds even though the contract already refuses control characters and limits emails to ASCII.

### Headers on every page

```
Content-Type: text/html; charset=utf-8
Content-Security-Policy: default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Cross-Origin-Opener-Policy: same-origin
Cache-Control: no-store
X-Robots-Tag: noindex, nofollow
Strict-Transport-Security: max-age=31536000        (only when the request is https)
```

`Referrer-Policy: no-referrer` keeps the slug from leaving in a `Referer` header; the pages load nothing from another site anyway. `/gallery.css` gets `Content-Type: text/css; charset=utf-8`, `nosniff`, and `Cache-Control: public, max-age=3600`. One test compares each header text whole.

## Pictures

`src/pictures/`. The service never stores picture bytes.

- **`PictureSource`** (`source.ts`) is the one interface the picture route uses: `get(ref: { url: string }): Promise<{ bytes: Uint8Array; type: 'image/png' | 'image/jpeg' } | null>`. `s3-source.ts` is today's only implementation. Replacing it with the Worker's own R2 bucket later (A-89) changes this folder, the `pictureUrl` field and the app's picture store, and nothing in the routes.
- **`checkPictureUrl(text, env)`** (`check-url.ts`), used when the API stores an address and again before every fetch:
  - `https:` only; no user name or password; no port, or port 443;
  - host, lower-cased, matching `^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]\.s3\.[a-z0-9-]+\.amazonaws\.com$` (a bucket's own host) or `^s3\.[a-z0-9-]+\.amazonaws\.com$` (path style), the two forms the app's S3 client makes (`spec/storage-and-publish.md`, "Allowed hosts");
  - **test origin:** only when the Worker's environment has `TEST_PICTURE_ORIGIN`, and that value is exactly `http://127.0.0.1:{port}`, an address with that exact origin is also allowed. Nothing else about the rule changes. It is set only by the tests (`--var` on `wrangler dev`, or a binding in the Vitest config), never in `wrangler.jsonc`, and never by a deploy step.
- **Fetching** (`s3-source.ts`): `fetch(url, { redirect: 'manual' })` with no added header and no cookie. Status must be 200: a redirect, 403 (an expired or wrong signature), 404 or any other is a failure. `Content-Length` over 16 MiB fails before reading; the body is read with a 16 MiB cap; the first bytes must be a PNG (`89 50 4E 47 0D 0A 1A 0A`) or a JPEG (`FF D8 FF`) (`sniff.ts`). The reply's own `Content-Type` is ignored.
- **The picture route.** Session check; the row `gallery_variant` for (this link, `variantKey`); `version` must equal the row's; `picture_expires_at` after now; then `PictureSource.get`. Any failure: `404` with an empty body. Success: the bytes, with `Content-Type` from the sniff, `X-Content-Type-Options: nosniff`, `Cache-Control: private, max-age=300`, `Content-Security-Policy: default-src 'none'; sandbox`, `Cross-Origin-Resource-Policy: same-origin`, `Referrer-Policy: no-referrer`.
- **An expired address.** Signed S3 addresses last at most 7 days. The app renews them when it refreshes (`spec/approvals.md`, "Refresh"). The gallery shows the expiry sentence above for a row whose time has passed. A picture that fails before its time (keys changed, object gone) shows the browser's broken picture with its `alt` text; the next "Update gallery" fixes it.

## Logs

The service writes no log line of its own except one `console.error` per unexpected failure, holding the route name and the error's name only. Never a key, password, cookie, token, email, picture address, slug or request body. Whether Workers Logs is switched on is the stakeholder's choice when deploying; the code does not need it.

## Tests

Everything runs on this machine with `npm test` in `approvals-service/` (the Cloudflare Vitest plugin, local Miniflare, D1 kept apart per test file). Route tests call `createApp(env, parts, tables?)` with a stand-in `PictureSource`, a fixed clock and, where a test needs it, a fixed random source; `env` comes from `cloudflare:workers`. One request through `exports.default.fetch` proves `index.ts` wires the same app. Prefer one table test over many near-identical cases.

| File | What it proves |
|------|----------------|
| `test/contract.test.ts` | Each contract rule: good values, each bound, a control character, a direction mark, a non-ASCII email |
| `test/random.test.ts` | Letters only from the alphabet, the right length; with a fixed byte source, bytes 248 to 255 are skipped and 247 gives `z` (247 % 62 = 61) |
| `test/password.test.ts` | Round trip; wrong password fails; the stored iteration count is used; a new password changes the salt |
| `test/api-auth.test.ts` | Table: no key, wrong key, a key one letter off, `API_KEY` unset or 31 characters (`503`), an `Origin` header with the right key (`403`), wrong content type, a 2 MiB + 1 body without `Content-Length`; none reaches a handler (the database is unchanged) |
| `test/api-links.test.ts` | Create, read, new password (sessions gone), gallery replace (order, removal of an unlisted variant and its sign-offs, older-version sign-offs kept), renewal (only matching versions), delete (every table empty for the link, another link untouched); a path naming another campaign gets `404` |
| `test/picture-url.test.ts` | Table: both S3 host forms pass; `http:`, another host, `amazonaws.com.evil.example`, a port, user info, an IP address, the test origin without `TEST_PICTURE_ORIGIN`, a different test port; all refused |
| `test/picture-route.test.ts` | No session `404`; a session of another link `404`; wrong version `404`; expired `404`; a stand-in source giving a redirect, 403, 17 MiB, or HTML bytes: `404`; a PNG passes with the exact headers |
| `test/session.test.ts` | Cookie attribute text exact; another link's cookie gives the password page; a malformed or expired token gives the password page; "Leave" ends it; the token is not stored, its hash is |
| `test/throttle.test.ts` | Ten wrong tries, then the right password is refused; after 15 minutes (fixed clock) it works; the unknown-slug, wrong-password and too-many replies are byte-equal |
| `test/forms.test.ts` | Table over every write route: no `Origin`, another `Origin`, `Sec-Fetch-Site: cross-site`, JSON content type, a 9 KiB body, no session: `403` and nothing written |
| `test/signoffs.test.ts` | Sign off, repeat adds nothing, old version gives `m=changed`, bad email gives `m=bad-email`, removing another link's sign-off removes nothing |
| `test/pages.test.ts` | A campaign name, title and size line holding `<script>`, `"`, `'`, `&` and `</style>` appear only escaped; every page's headers equal their full expected text; an unknown `m` shows no notice |
| `test/config.test.ts` | `wrangler.jsonc` has `send_metrics: false`, no `vars` entry named `API_KEY` or `TEST_PICTURE_ORIGIN`, and the all-zero `database_id` |
| `test/routes.test.ts` | A handler gets its body as its schema parsed it; `check` runs after the schema and before the handler; the gallery and picture-renewal routes are stubs or have a `check`; a throwing visitor handler gives the fixed `500` and logs names only |
| `test/db.test.ts` | Each data-access function round trip; a link delete removes its sessions, sign-offs and gallery rows only |
| `test/worker.test.ts` | `exports.default.fetch` answers health with the key and an unknown path. Its `/robots.txt` row expects the stub's `404` today; AP-3 changes it to the real reply |

## Running it locally

- `npm run dev` in `approvals-service/`: `wrangler dev --ip 127.0.0.1 --port 8787` (local mode is the default) with `WRANGLER_SEND_METRICS=false`. A local `API_KEY` comes from `approvals-service/.dev.vars`, which git ignores; the developer makes a random value and never prints it.
- `npm run db:local`: `wrangler d1 migrations apply DB --local`.
- `wrangler dev` serves plain `http` on `127.0.0.1`. Browsers count `127.0.0.1` as a secure place, so the `Secure` cookie works there; AP-13 confirms this in a real browser and switches to `localhost` if it does not.

## Deploying

The stakeholder's steps, written into `approvals-service/README.md` by AP-13. No value is written in the repository; the stakeholder supplies each one.

1. A Cloudflare account, signed in on this machine with `npx wrangler login`.
2. `npx wrangler d1 create adman-approvals`; put the database ID it prints into `wrangler.jsonc` in place of the zeros.
3. `npx wrangler d1 migrations apply DB --remote`.
4. Make a long random key (at least 32 characters; for example `openssl rand -base64 48`) and store it with `npx wrangler secret put API_KEY`. Keep it for step 6; it is not shown again.
5. `npx wrangler deploy`. The address it prints (or a custom domain set up in Cloudflare) is the service address.
6. In the app: Settings, "Approvals service": the address and the key, then "Test connection".
7. In the app: Settings, "Cloud storage": the S3 bucket, region and keys (the same ones publishing uses).

To change the key later: step 4 again with a new value, then the new key in the app. Every session and link stays as it was.

**Values the stakeholder supplies:** the Cloudflare account; the D1 database ID; the `API_KEY` value; the service address (a `workers.dev` address or a custom domain). The CPU time a password check needs is in OI-94.
