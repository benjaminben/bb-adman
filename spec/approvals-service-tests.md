# Approvals service: tests

The tests of the approvals service [D-095, D-097]. Read with `spec/approvals-service.md`, `spec/approvals-service-data.md`, `spec/approvals-service-visitor.md` and, for the page tests, `spec/approvals-gallery.md` "Tests". The desktop app's approvals tests are in `spec/approvals.md`, "Named tests".

Everything runs on this machine. **Vitest** (`npm test`): plain Node, no network. **Playwright** (`npm run test:e2e`): `next build`, then `next start` listening on `127.0.0.1` with a local database file. **Every e2e base address uses `localhost`** (`http://localhost:{port}`), because that is the origin `request.url` gives on local `next start` and the form Origin check is never loosened to fit a test (`spec/approvals-service-visitor.md`, "Forms that write").

## The port (AP-14): same tests, same assertions, new harness

**Built (AP-14).** `test/db.ts` makes one in-memory database per test file (`openDb(':memory:')`; Vitest loads modules apart per file) and applies `migrations/*.sql` with the migrate function from `scripts/migrate.ts`. Files that change and how:

| File | Change |
|---|---|
| `vitest.config.ts` | No Cloudflare plugin; `environment: 'node'`; alias `server-only` → `test/empty.ts`; a random `API_KEY` per run in `test.env` |
| `test/setup.ts`, `test/env.d.ts` | Deleted (replaced by `test/db.ts`) |
| `test/tsconfig.json` | Node and Vitest types in place of the Workers types |
| `test/api-helpers.ts`, `test/visitor-setup.ts` | `import { env } from 'cloudflare:workers'` and `env.DB` become `import { db } from './db'` and `db` |
| Every test using `reply.json<T>()` (a Workers typing) | `(await reply.json()) as T` |
| Every other `test/*.test.ts` touching `env` | Builds its `Env` object with `db` |
| `test/config.test.ts` | Rewritten: checks `package.json` (pins, banned packages, telemetry off in scripts, `allowScripts`), `next.config.ts` settings, the `server-only` lines, imports under `app/` and `src/ui/`, `process.env` only in its four files (test files exempt), no `'use server'` |
| `test/worker.test.ts` | Becomes `test/entry.test.ts`: the catch-all's exported `GET` answers health with the key, `robots.txt`, and an unknown path with the plain 404; `loadEnv` drops `TEST_PICTURE_ORIGIN` when `VERCEL=1` and treats a missing database address as not set up |

Every other assertion stays as it was. The developer reports the count of tests per file before and after; only the two rewritten files may differ.

## Test files (all phases)

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
| `e2e/api.spec.ts` (AP-14) | Against `next start` at `http://localhost:{port}`: health with the key; `401` without; the full reply header list (with `vary` and `content-encoding` in the allow-list); a trailing slash answered by the router, not a redirect |
| `e2e/gallery.spec.ts`, `e2e/shots.spec.ts` (AP-16) | `spec/approvals-gallery.md`, "Tests"; both at `http://localhost:{port}` |

## Playwright set-up (AP-14)

**Built (AP-14).** `playwright.config.ts`: `globalSetup` makes a temporary folder, runs the migrations on `file:{folder}/e2e.db`, makes a random `API_KEY`, and (from AP-4) starts a static server on a free `127.0.0.1` port serving `e2e/pictures/`; `webServer` runs `npm run build` then `npm run start -- -p {free port}` with `API_KEY`, `TURSO_DATABASE_URL=file:{folder}/e2e.db`, `TEST_PICTURE_ORIGIN=http://127.0.0.1:{picture port}` and `NEXT_TELEMETRY_DISABLED=1` in its environment, and waits for `/robots.txt`. The base address of every test is `http://localhost:{port}`. The picture server stays on `127.0.0.1`: only the service fetches from it, so no form Origin check meets it. Tests seed links through the keyed API, as the app would, and plant sign-offs through the API's own database file only where a case needs it. Only Chromium is used; if it is not installed, the developer reports rather than downloads it.
