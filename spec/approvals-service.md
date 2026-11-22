# Approvals service

The small web service behind approval links [D-095, D-097]: one Next.js app hosted on Vercel, with a Turso (libSQL, SQLite-compatible) database from the Vercel Marketplace. It serves the visitor's pages (password, gallery, sign-off) and a keyed API for the desktop app.

**State.** **Built**: a Next.js app with a libSQL database, tested with plain Node tests (slices in `spec/phases/approvals-service-slices.md`). Its deploy steps are in `approvals-service/README.md`.

**Where things are.** This file: what the service is, how Next.js and the service code fit, folder and tooling, environment, logs, running it locally, deploying. The rest of the service:

- `spec/approvals-service-data.md`: the shared contract, the database and the migrate script, random values and passwords, the keyed API.
- `spec/approvals-service-visitor.md`: visitor routes and logic (sessions, the gallery view, the try limit, forms, notices, header sets) and pictures on the service's side.
- `spec/approvals-service-tests.md`: the tests, the port of the tests in AP-14, the Playwright set-up.

Read with `spec/approvals.md` (the desktop side, the security rules and threats, assumptions A-82 on) and `spec/approvals-gallery.md` (the pages: Next.js settings, the security headers, components, words, page tests).

## What it is

- One Next.js app, one database, one secret key. No other hosted product (no blob store, no cache store, no queue, no analytics).
- The desktop app is the only writer of links and galleries. It talks to the service over HTTPS with a secret key (`API_KEY`). It never reaches the database directly. It knows only the service address and the key, so the host does not matter to it.
- A visitor reaches the service with a link `{origin}/l/{slug}` and a password. After the password they see the campaign's variants and may add or remove a sign-off. They have no account.
- Pictures stay in the user's own S3 bucket. The app gives the service a signed read address for each picture; the service fetches the picture itself and passes it on only to a visitor who has entered the password. A visitor never sees the bucket address.
- **Nothing is deployed by an agent** (D-086). Agents build and test on this machine only, with a local database file or an in-memory one. No agent runs `vercel login`, `vercel link`, `vercel deploy`, `vercel env pull`, `vercel install`, any other command that contacts Vercel, or anything that contacts a hosted database (`npm run db:migrate -- --hosted` included). The Vercel command-line tool is not a dependency. The stakeholder deploys ("Deploying", below).

## How Next.js and the service code fit

**Built (AP-14).** Next.js owns two things: the page `GET /l/{slug}` (the password page or the gallery, `spec/approvals-gallery.md`) and the page nonce made in `proxy.ts`. **Every other request** goes through one route handler, `app/[[...path]]/route.ts`, which hands the `Request` unchanged to the existing `createApp(env, parts)`. So the keyed API, the visitor's form posts, the picture route, `robots.txt` and the plain 404 all keep the one reviewed router, with its order of checks, header sets and body caps.

```ts
// app/[[...path]]/route.ts (AP-14); every HTTP method, so Next.js answers no method itself
// (it still answers a few requests before the router: "What Vercel and Next.js add or change in front")
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
| Request body limit | Vercel refuses a body over 4.5 MB with its own `413` before the code runs | The service's own caps (4 MiB API since R2V-1, 8 KiB forms; a clip reply at most 4 MiB) are below it. A body over 4.5 MB gets Vercel's 413 even without a key: a refusal either way, accepted |
| Reply size limit | 4.5 MB for a reply that is not streamed | API replies stay far below. Pictures (up to 16 MiB) are sent as a stream (`spec/approvals-service-visitor.md`, "Pictures") |
| `request.url` | Next.js builds it from the `Host` the browser used (Vercel: "the domain name as it was accessed by the client") and the protocol. On local `next start` it is `http://localhost:{port}/…`, not `http://127.0.0.1:{port}/…`, though the server listens on `127.0.0.1` | See `spec/approvals-service-visitor.md`, "Forms that write": the Origin check stays sound whatever the value, and fails closed if it is wrong. So every e2e base address uses `localhost` |
| The protocol | On Vercel the protocol is fixed. On local `next start` only, a client-sent `X-Forwarded-Proto: https` is honoured, so `request.url` starts with `https:` | Nuisance only (a local visitor can make their own forms fail or get an extra header); noted, not fixed |
| Requests Next.js answers itself | A few requests are answered before the router: a request with an `rsc` header gets a `307`; a path holding `//` or `\` gets a `308`; `/_not-found`, `/_error`, `/500`, `/_next/image`, `/_next/data/*` and `/_global-error` get Next.js's own pages | None of these replies carries link data, a key or a session; accepted |
| Trailing slash | Next.js would redirect `/api/v1/health/` with a 308 | `skipTrailingSlashRedirect: true` in `next.config.ts`; the router answers as before |
| `OPTIONS`, `HEAD` | Next.js answers them itself when a route does not export them | The catch-all exports every method |
| Compression | Next.js compresses replies (`Content-Encoding: gzip`) and adds `Vary` | Compression stays on: no reply body holds a secret beside text an attacker chooses, so compression gives nothing away |
| Headers added | Vercel adds `server`, `date`, `x-vercel-id`, `x-vercel-cache` and, on its domains, `strict-transport-security: max-age=63072000`; Next.js adds `x-powered-by` unless switched off, `vary` and `content-encoding` | `poweredByHeader: false`. Vercel's headers carry no link data. `e2e/api.spec.ts` lists the full header set of `next start` replies; any header outside the expected set and the named allow-list (`date`, `connection`, `keep-alive`, `transfer-encoding`, `content-length`, `vary`, `content-encoding`) fails it. AP-13's hand check lists the deployed headers |
| Caching | Vercel's CDN caches a function reply only when told to (`s-maxage` or similar) | Every reply sets `Cache-Control: no-store`, the picture too |

## Folder and tooling

**Built (AP-14)**, except the files marked for later slices.

```
approvals-service/
  package.json            own dependencies; "type": "module"; private; "engines": { "node": "24.x" }
  next.config.ts          "Next.js settings" in spec/approvals-gallery.md
  tsconfig.json           strict; DOM and JSX libs (for app/ and src/ui/); no path aliases
  next-env.d.ts           made by Next.js; ignored by git, eslint and Prettier
  vitest.config.ts        plain Node environment; aliases `server-only` to test/empty.ts
  playwright.config.ts    e2e against `next start` listening on 127.0.0.1, addressed as localhost
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
| `typescript` | `6.0.3` | No | None | Apache-2.0 |
| `vitest` | `5.1.1` | No | None | The app's version |
| `@playwright/test` | `1.65.1` | No | None | Apache-2.0. The app's version, so the browsers already installed for the app are used |
| `@types/node` | `24.10.1` | No | None | |
| `@types/react`, `@types/react-dom` | `19.3.0` | No | None | |
| `caniuse-lite` | As `next` resolves it | With `next` | None | CC-BY-4.0 (a data licence that asks for credit; it is kept in the package) |
| `lightningcss` | As `next` resolves it | No (build and test only) | None | MPL-2.0 |
| `@img/sharp-*` and libvips | As `next` resolves them | No (never loaded) | None | LGPL-3.0-or-later. Optional dependency of `next`, unused because images are unoptimized |

- **Install scripts.** The `allowScripts` list is replaced by: `"sharp@{the version npm resolves}": false`, `"fsevents@2.3.3": false`, and a `false` entry for any other package that asks. `sharp` (Apache-2.0; its `@img/sharp-libvips-*` parts are LGPL-3.0-or-later) is an optional dependency of `next` and is never loaded at run time, because image optimisation is off. If `next build` will not run without a script, the developer stops and reports.
- **Banned:** GPL and AGPL; any analytics, speed-insights or telemetry package; `@vercel/*` runtime packages; the `vercel` and `wrangler` tools. `test/config.test.ts` checks `package.json`.
- **No telemetry.** Every script that runs `next` sets `NEXT_TELEMETRY_DISABLED=1` inline (fine on macOS and Linux, not in Windows `cmd`).
- **Scripts.** `dev`: `NEXT_TELEMETRY_DISABLED=1 next dev -H 127.0.0.1 -p 3000`; `build`: `NEXT_TELEMETRY_DISABLED=1 next build`; `start`: `NEXT_TELEMETRY_DISABLED=1 next start -H 127.0.0.1`; `typecheck`: `tsc --noEmit -p tsconfig.json && tsc --noEmit -p test/tsconfig.json`; `test`: `vitest run`; `test:e2e`: `NEXT_TELEMETRY_DISABLED=1 playwright test`; `db:migrate`: `node scripts/migrate.ts`.
- **Root files** (AP-14): `.gitignore` swaps the Wrangler lines for `approvals-service/.next/`, `approvals-service/next-env.d.ts`, `approvals-service/.env*.local`, `approvals-service/*.db`, `approvals-service/test-results/`, `approvals-service/playwright-report/`; `eslint.config.js` and `.prettierignore` ignore `approvals-service/.next/`, `approvals-service/node_modules/` and `approvals-service/next-env.d.ts`.

## Environment

**Built (AP-14).** `src/server/env.ts` `loadEnv(): Env` reads the process environment on each request:

| Variable | Set by | Use |
|---|---|---|
| `API_KEY` | The stakeholder in Vercel (marked Sensitive, Production only); tests make a random one per run | The key check. Missing or under 32 characters: every API request gets `503 not_set_up` |
| `TURSO_DATABASE_URL` | The Turso integration, when the database is connected to the project; tests use `:memory:` or `file:{temporary folder}/e2e.db` | The database address. Missing: `loadEnv` treats `API_KEY` as missing too (the API answers `503 not_set_up`) and visitor routes answer the fixed `500` |
| `TURSO_AUTH_TOKEN` | The Turso integration | The database token; unset for local files |
| `TEST_PICTURE_ORIGIN` | Tests only | The test picture origin (`spec/approvals-service-visitor.md`, "Pictures"). `loadEnv` drops it whenever `VERCEL` is set (Vercel sets `VERCEL=1` on every deployment, production and preview), so it can never take effect on a deployment; then `testPictureOriginOf` still accepts only exactly `http://127.0.0.1:{port}` |
| `VERCEL` | Vercel | Read only by the rule above |

- One database client per server instance, made on first use and kept (`openDb`), so warm requests reuse it.
- No variable is read anywhere else; `test/config.test.ts` fails if `process.env` appears outside `src/server/env.ts`, `scripts/migrate.ts`, `next.config.ts` and `playwright.config.ts`. Test files are exempt from this rule.
- **Web Crypto under Node.** `crypto.getRandomValues` and `crypto.subtle` (PBKDF2, SHA-256) are global in Node 24 and give the same results as before; the password tests prove it. Node sets no cap on PBKDF2 iterations, so the old "the local runtime does not enforce 100,000" gap is gone.

## Logs

The service writes no log line of its own except one `console.error` per unexpected failure, holding the route name and the error's name only. Never a key, password, cookie, token, email, picture address, slug or request body. A page that fails logs the same way and then throws a fixed `PageFailed` error, so Next.js's own log line holds only that name and a trace through our code. Vercel's runtime logs show these lines; nothing else is sent anywhere. The migrate script has its own rule (`spec/approvals-service-data.md`, "Database").

## Running it locally

- `npm run dev` in `approvals-service/`: `next dev` on `127.0.0.1:3000`. Next.js reads local values from `approvals-service/.env.local`, which git ignores; the developer makes a random `API_KEY` there and a `TURSO_DATABASE_URL` of `file:local.db`, never prints the key, and runs `npm run db:migrate` once. Development mode loosens the page policy (`spec/approvals-gallery.md`), so tests and shots use `next start`.
- `next start` serves plain `http`, listening on `127.0.0.1`. A browser opens it as `http://localhost:{port}`, since that is the origin `request.url` gives and the form Origin check compares against it. Browsers count `localhost` as a secure place, so the `Secure` cookie works there; AP-13 confirms this in a real browser.

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
