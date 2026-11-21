# Approvals gallery (the visitor's pages)

The pages a visitor sees when they open an approval link: the password page and the gallery with its sign-off forms [D-095, D-097]. Built with Next.js `16.4.6` (App Router) and React `19.3.1`, inside the approvals service (`spec/approvals-service.md`), hosted on Vercel. Everything in this file is **Not built** (AP-16, after AP-15 and AP-4; `spec/phases/approvals-service-slices.md`), except the `next.config.ts` settings AP-14 made.

What a page may and may not do is set by the service: the session, the try limit, the form checks, the gallery view and every write live in `src/visitor/` and are reached through the catch-all route. A page only reads a `GalleryView` and draws it. Every form posts to the catch-all, never to a page.

## What changes for the visitor, and what is lost

The pages look and behave as before: plain forms, a redirect after each one, nothing that needs script. What is lost compared with the earlier no-script design: each page now loads the framework's own scripts (React and Next.js, served from our own address, roughly 100 KB or more), so the page policy must allow our own scripts by a one-time nonce instead of allowing none, and a phone has more to download. The gain is a page built from small components and one set of tokens, and room to add script that improves a page later without being needed.

## Next.js settings

`next.config.ts` (`test/config.test.ts` checks each value):

| Setting | Value | Why |
|---|---|---|
| `poweredByHeader` | `false` | No `x-powered-by` header |
| `reactStrictMode` | `true` | |
| `images.unoptimized` | `true` | No image optimisation; `sharp` never loads. Pictures are plain `<img>` tags pointing at the service's picture route |
| `skipTrailingSlashRedirect` | `true` | The router, not Next.js, answers a trailing slash |
| `productionBrowserSourceMaps` | `false` | No source code sent to browsers |
| `serverExternalPackages` | `['@libsql/client', 'libsql']` | The database client is loaded by Node, not bundled |
| The project root (the root settings Next.js names when it finds more than one lockfile) | The `approvals-service/` folder | The repository has a second lockfile at its root; without this the build guesses the root from it |
| Not set | `cacheComponents`, `headers()`, `rewrites()`, `redirects()`, `output`, `experimental.*` | Nothing cached, no second place that sets headers or routes |

**Nothing about a link is built ahead or cached:**

- `app/layout.tsx` exports `dynamic = 'force-dynamic'` (the route segment setting that still exists in Next.js 16 when Cache Components is off), so every page, `not-found` included, renders per request.
- `app/l/[slug]/page.tsx` also exports `dynamic = 'force-dynamic'`, reads `headers()`, has no `generateStaticParams`, and nothing under `app/` or `src/` uses `'use cache'`, `unstable_cache` or a cached `fetch`.
- No incremental cache store is set up; Vercel's CDN caches a function reply only when told to, and no visitor reply says so.
- `e2e/build.spec.ts` reads `.next/prerender-manifest.json` after the build: no route under `/l` is listed.
- Every reply's final `Cache-Control` is checked in `e2e/gallery.spec.ts`: it contains `no-store` and never `public` or `s-maxage` (pages get Next.js's own `private, no-cache, no-store, max-age=0, must-revalidate`; catch-all replies `no-store`).

**Nothing fetched from another company:** no `next/font` (it fetches font files at build time) and no web font: the font is `system-ui, sans-serif`. No `next/image`, no `next/script`, no analytics or speed-insights package. Telemetry off in every script (`NEXT_TELEMETRY_DISABLED=1`). `test/config.test.ts` fails on an import of `next/font`, `next/image`, `next/script` or any `@vercel/` package.

**No Server Actions** and no client component except the two error boundaries (`error.tsx`, `global-error.tsx`, which Next.js requires to be client components). `test/config.test.ts` fails on `'use server'` anywhere and on `'use client'` in any other file.

## The page policy and nonce (`proxy.ts`)

Next.js applies a nonce to its own script and style tags when the request carries a `Content-Security-Policy` header holding `'nonce-{value}'`, and only on pages rendered per request (Next.js docs, "Content Security Policy", checked 2026-11). `proxy.ts` (Next.js 16's name for middleware) makes it. It does nothing else: no session check, no try count, no database.

```ts
export const config = { matcher: ['/l/:slug'] }  // one path part only; the API never passes here
```

1. The method is `GET` or `HEAD` and the slug matches `SLUG`; otherwise it answers the plain 404 itself ("Not found.", the plain text headers from `visitor/headers.ts`).
2. Nonce: 16 bytes from `crypto.getRandomValues`, base64. New on every request.
3. Request headers: a copy of the visitor's, with any `Content-Security-Policy` and `x-nonce` the visitor sent deleted, then `Content-Security-Policy` set to the page policy below, so Next.js reads our nonce and never one the visitor chose.
4. `NextResponse.next({ request: { headers } })`, with the page header set (below) put on the response.

Page policy, from `pagePolicy(nonce, dev = false)` in `src/visitor/headers.ts` (AP-15, built; it throws on a nonce that is not 22 base64 characters plus `==`), one line:

```
default-src 'none'; script-src 'self' 'nonce-{nonce}'; style-src 'self' 'nonce-{nonce}'; img-src 'self'; font-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'
```

- No other origin anywhere. Scripts only from our own address or carrying the nonce; no `'unsafe-inline'`, no `'unsafe-eval'`, no `'strict-dynamic'` (the framework loads its later pieces from our own address, which `'self'` covers).
- Only when `dev` is true: `'unsafe-eval'` is added to `script-src` and `'unsafe-inline'` to `style-src`, as the Next.js docs require for its development tools. `next start` and Vercel never run in development mode, so tests and shots always see the strict policy. `NODE_ENV` is read only in `src/server/env.ts`, which exports `isDev()` (`NODE_ENV` is `development` under `next dev`). `proxy.ts` imports `isDev` and passes it to `pagePolicy` and to `pageHeaders(request, nonce, dev = false)`, which makes the page header set.
- `e2e/gallery.spec.ts` fails on any policy refusal reported in the browser during its flow, so a refused framework script or style is found, not hidden.

Page header set (with the policy above): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `Cross-Origin-Opener-Policy: same-origin`, `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, and `Strict-Transport-Security: max-age=31536000` when the request is https.

**If `proxy.ts` did not run,** a page would arrive without our policy header. That is a weaker page, not an open door: React still escapes every value, and the session and every check still run in the logic. `e2e/gallery.spec.ts` checks the policy is on every page reply.

## Routes

| Path | File | Kind | Calls | Returns |
|---|---|---|---|---|
| `GET /l/{slug}` | `app/l/[slug]/page.tsx` | Server component | `openGallery(db, { slug, cookie, m }, Date.now())` | `PasswordScreen` (with the `wrong-password` notice when `m` says so) or `GalleryScreen` with the view. Status 200 in both cases, for a real slug and an unknown one alike |
| `POST /l/{slug}/enter`, `/leave`, `/signoffs`, `/signoffs/{id}/remove` | `app/[[...path]]/route.ts` | Route handler (catch-all) | `createApp` → `visitor/routes.ts` | `303`, or the `403` plain text reply (`spec/approvals-service-visitor.md`, "Visitor routes and logic") |
| `GET /l/{slug}/p/{variantKey}/{version}` | the same | Route handler | `picture-route.ts` | The picture as a stream, or `404` with an empty body |
| `GET /robots.txt` | the same | Route handler | `visitor/routes.ts` | `User-agent: *` and `Disallow: /` |
| A wrong-shape slug at `/l/{x}` | `proxy.ts`; `page.tsx` as a second guard | Proxy; `notFound()` | — | Plain 404. If the proxy were skipped, the page calls `notFound()` and `app/not-found.tsx` draws "Not found." |
| Any other path | `app/[[...path]]/route.ts` | Route handler | `createApp` | Plain 404 |
| A page that throws | `app/l/[slug]/error.tsx`, `app/global-error.tsx` | Client components | — | The fixed sentence "Something went wrong. Try again later." and nothing else; status 500 |

Rules the page keeps:

- **One reply for an unknown slug, a wrong password and too many tries.** Entering answers the same `303` in all three cases (the service); the password page that follows is the same for an unknown slug and a real one (status 200, the same bytes once the nonce is set aside). The page never calls `notFound()` or `redirect()` for a slug of the right shape, and sets no cookie.
- **The link comes only from the path's slug and the session cookie.** The page passes `slug` (from `params`) and the `Cookie` header text to `openGallery`; it reads no form field and no other header.
- **Only the view reaches a component.** The page imports `openGallery` and the `GalleryView` type; components take parts of the view as props.
- **Errors.** The page's call is wrapped: a throw logs `gallery-page` and the error's name, then throws a fixed `PageFailed` error. In production Next.js sends no message or stack to the browser; `error.tsx` shows only the fixed sentence and never reads the error object.

## Look and structure

The user's rule for all UI: modular components styled from one set of tokens that can be changed in one place. Plain, clean, readable on a phone. No UI library. Styling with **CSS Modules** (one `.module.css` per component; Next.js builds them into files served from our own address, which the policy allows). Only `src/ui/tokens.css` is a global stylesheet, imported once by `app/layout.tsx`. No component holds a colour, size or font of its own: every value is a `var(--…)` from the tokens.

### Tokens (`src/ui/tokens.css`)

```css
:root {
  --color-page: #f5f6f8;
  --color-surface: #ffffff;
  --color-text: #1c2127;
  --color-muted: #59626e;
  --color-border: #d6dbe1;
  --color-accent: #1f5fd6;
  --color-accent-text: #ffffff;
  --color-focus: #1f5fd6;
  --color-info-bg: #eaf1fd;
  --color-error-bg: #fcecec;
  --color-error-text: #8a1f1f;
  --color-placeholder: #e7eaee;
  --font-body: system-ui, sans-serif;
  --text-small: 0.875rem;
  --text-base: 1rem;
  --text-title: 1.5rem;
  --line-height: 1.5;
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --radius: 0.5rem;
  --control-height: 2.75rem;
  --card-min: 16.25rem;
  --page-max: 70rem;
}
```

The text colours meet a contrast of at least 4.5 to 1 on their backgrounds. `--control-height` (44 px) keeps buttons and fields easy to tap.

### Components (`src/ui/{name}/{name}.tsx` and `{name}.module.css`, all server components)

| Component | Props | What it draws |
|---|---|---|
| `page-shell` | `children` | `<main>` centred, at most `--page-max` wide, `--space-4` padding on a phone, `--space-8` from 48rem up |
| `notice` | `tone: 'info' \| 'error'`, `children` | A box with `role="status"` (info) or `role="alert"` (error) |
| `button` | `children`, `look: 'primary' \| 'quiet'`, optional `label` | A submit `<button>`; `label` becomes `aria-label` |
| `password-screen` | `slug`, `notice` | Heading, sentence, the error notice when set, `password-form` |
| `password-form` | `slug` | `<form method="post" action="/l/{slug}/enter">`, labelled password field, "Open" |
| `gallery-screen` | `view` | `gallery-header`, the notice, then `gallery-grid` or the empty line |
| `gallery-header` | `slug`, `campaignName` | Heading, the intro sentence, a "Leave" form posting to `/l/{slug}/leave` |
| `gallery-grid` | `children` | `display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--card-min), 1fr)); gap: var(--space-4)`, so it holds one variant or hundreds |
| `variant-card` | `slug`, `variant`, `current`, `earlier` | `<article id="v-{variantKey}">`: `variant-picture`, title, size line, the two lists, `signoff-form` |
| `variant-picture` | `slug`, `variantKey`, `version`, `title`, `expired` | `<img src="/l/{slug}/p/{variantKey}/{version}" alt="{title}" loading="lazy">` filling the card width, or, when `expired`, a `--color-placeholder` box with the expiry sentence |
| `signoff-list` | `slug`, `heading`, `signoffs`, `muted`, `emptyText?` | The heading, then each sign-off as `{email} · {date}` with a "Remove" form posting to `/l/{slug}/signoffs/{id}/remove`; `emptyText` when the list is empty; the earlier list is left out when empty |
| `signoff-form` | `slug`, `variantKey`, `version` | `<form method="post" action="/l/{slug}/signoffs">`: hidden `variant` and `version`, labelled email field, "Sign off" |

- `src/ui/format-date.ts`: `YYYY-MM-DD HH:MM UTC` from milliseconds.
- `src/ui/group-signoffs.ts`: for one variant, `current` (same version) and `earlier` (older versions), each oldest first.
- Every value from outside our code (campaign name, titles, size lines, emails) is drawn as a React text child, which React escapes. No `dangerouslySetInnerHTML` anywhere (`test/config.test.ts` fails on it). Every `action` and `src` is built only from the checked slug, a variant key from the view and a whole number.
- `app/layout.tsx`: `<html lang="en">`, `<meta name="referrer" content="same-origin">`, `<meta name="robots" content="noindex, nofollow">`, the tokens, `<body>` with `--font-body`, `--color-page` and `--color-text`.
- Each page sets its `<title>` with a React `<title>` element (React 19 moves it into the head).

### Words

**Password page.** Title "Review campaign". Heading "Review campaign". Text "Enter the password you were given." Field label "Password" (`type="password"`, `name="password"`, `autocomplete="current-password"`, `required`). Button "Open". After a failed try, above the form (error tone): "That password did not work. If you have tried many times, wait 15 minutes and try again." No campaign name, since the visitor has not proven anything yet.

**Gallery page.** Title: the campaign name. Heading: the campaign name. Under it: "Sign off on a variant by entering your email address. Anyone with this link can see who signed off, and can remove a sign-off." and the button "Leave" (quiet). Then the notice for `m`, if any (info tone; `bad-email` in error tone), with the words in `spec/approvals-service-visitor.md`, "Notices". Then one card per variant in gallery order:

- The picture, or the grey box: "This picture has expired. Ask the person who sent the link to update the gallery."
- The title (as a level-2 heading) and the size line (muted).
- "Signed off by" (level-3 heading): each current sign-off as `{email} · {date}` with a "Remove" button (accessible name "Remove sign-off by {email}"). None: "No sign-offs yet."
- "For an earlier version" (level-3 heading, muted): each older sign-off the same way. Left out when there are none.
- Field label "Your email" (`type="email"`, `name="email"`, `autocomplete="email"`, `required`), button "Sign off".

**A gallery with no variants:** "Nothing to review yet."

**Not found:** "Not found." **Error:** "Something went wrong. Try again later."

## Tests

| File | What it proves |
|---|---|
| `test/ui.test.tsx` (Vitest, `react-dom/server` `renderToStaticMarkup`) | One table over the components: a campaign name, title, size line and email holding `<script>`, `"`, `'`, `&` and `</style>` appear only escaped; current and earlier groups; the earlier heading left out when empty; the expired box; the date format; every field has a label; the error components show only the fixed sentence |
| `e2e/build.spec.ts` | No prerendered route under `/l` |
| `e2e/gallery.spec.ts` (Chromium, against `next start`, every address `http://localhost:{port}`, never `127.0.0.1`: the form Origin check is not loosened for it, `spec/approvals-service-visitor.md` "Forms that write") | (1) An unknown slug and a real slug without a session give the same status and the same body once nonces are set aside; the header list equals the page set plus the allow-list in `spec/approvals-service.md` (`vary` and `content-encoding` included); no `Set-Cookie`. (2) A wrong password, then the right one: the notice, then the gallery in order with its pictures loaded from the test picture server; the cookie's attribute text exact. (3) With JavaScript switched off in the browser: sign off, see the notice and the email; remove it; leave and land on the password page. (4) With JavaScript on, the same flow reports no policy refusal. (5) `/l/short` and `/l/%41aaaaaaaaaaa` give the plain 404. (6) Every reply in the flow is `no-store`, none `public` or `s-maxage`; every page reply carries the page policy with a new nonce each time |
| `e2e/shots.spec.ts` | The screenshots below |

**Screenshots for the user** (D-084 range 90 to 99), by `npm run test:e2e -- e2e/shots.spec.ts` against `next start`, written to the root `shots/` folder (not in git) and named in the developer's report: `98-gallery-password` (phone, 390 × 844), `98-gallery-password-wrong` (phone, after a wrong try), `99-gallery` (desktop, 1280 × 900, three variants: one with a current sign-off, one with an earlier-version sign-off, one expired), `99-gallery-phone` (phone, the same gallery).
