# Approvals gallery (the visitor's pages)

The pages a visitor sees when they open an approval link: the password page and the gallery with its sign-off forms [D-095, D-097]. Built with Next.js `16.4.6` (App Router) and React `19.3.1`, inside the approvals service (`spec/approvals-service.md`), hosted on Vercel. Everything in this file is **Built** (slices: `spec/phases/approvals-service-slices.md`, `round-2-approvals.md`, `round-2-approvals-video.md`).

What a page may and may not do is set by the service: the session, the try limit, the form checks, the gallery view and every write live in `src/visitor/` and are reached through the catch-all route. A page only reads a `GalleryView` and draws it. Every form posts to the catch-all, never to a page.

**The gallery page in short.** The full design, with every word of the sidebar, the cards and the lightbox, is in `spec/phases/round-2-approvals.md` and `round-2-approvals-video.md`.

- **Layout.** A sidebar (the campaign title, a fixed instruction sentence, "Signing off as:" with one email field and "Use this email", "Sign off all…" with a confirmation dialog, "Log out") beside a masonry of variant cards. Each card opens a lightbox (HTML's own `<dialog>` and command buttons) with the large picture, or for a video variant the clip in the browser's own player, and the sign-off button; other reviewers' sign-offs show in full there, each with "Remove". A card that needs this reviewer's sign-off has an accent edge and a raised shadow; a signed one a quiet edge with a green tick; each state also has words. Only sign-offs of the current version show.
- **Script.** Everything works with script off. One small plain script of the service's own adds arrow keys and Previous and Next between lightboxes, a fallback for browsers without command buttons, masonry spans where CSS grid lanes are missing, and pausing a video when its lightbox closes (a failed clip shows a notice).
- **Look.** `src/ui/app-tokens.css` is a byte-for-byte copy of the app's own `src/renderer/ui/tokens.css`, kept in step by the root test `tests/unit/config/approvals-tokens.test.ts`; buttons and fields are 44 px tall with 16 px text for phones.
- **Reviewer email.** Saved by "Use this email" (route `/reviewer`) in a browser-session `HttpOnly` cookie to fill the field and mark the cards; cleared by "Log out" (route `/leave`) and by every right password entry. Every sign-off uses the posted field text. "Sign off all" is one request carrying a stamp of the shown set; a stale stamp writes nothing; expired pictures are left out.
- **Clips.** `GET /l/{slug}/c/{variantKey}/{version}`, signed-in visitors only, one plain byte range per request, at most 4 MiB per reply; anything else gets the empty `404`. The page policy below has `media-src 'self'`.

## What the framework costs the visitor

The pages use plain forms, a redirect after each one, and nothing that needs script. The cost: each page loads the framework's own scripts (React and Next.js, served from our own address, roughly 100 KB or more), so the page policy allows our own scripts by a one-time nonce, and a phone has more to download. The gain is a page built from small components and one set of tokens, and room for script that improves a page without being needed.

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

**No Server Actions** and no client component except the two error boundaries (`app/l/[slug]/error.tsx`, `app/global-error.tsx`, which Next.js requires to be client components) and the gallery script (`src/ui/gallery-script/gallery-script.tsx`, ruling S-12 in `spec/phases/round-2-approvals.md`: it draws nothing, reads no address, cookie or storage, and sends no request). `test/config.test.ts` fails on `'use server'` anywhere and on `'use client'` in any other file.

## The page policy and nonce (`proxy.ts`)

Next.js applies a nonce to its own script and style tags when the request carries a `Content-Security-Policy` header holding `'nonce-{value}'`, and only on pages rendered per request (Next.js docs, "Content Security Policy", checked 2026-11). `proxy.ts` (Next.js 16's name for middleware) makes it. It does nothing else: no session check, no try count, no database.

```ts
export const config = { matcher: ['/l/:slug'] }  // one path part only; the API never passes here
```

1. The method is `GET` or `HEAD` and the slug matches `SLUG`; otherwise it answers the plain 404 itself ("Not found.", the plain text headers from `visitor/headers.ts`).
2. Nonce: 16 bytes from `crypto.getRandomValues`, base64. New on every request.
3. Request headers: a copy of the visitor's, with any `Content-Security-Policy` and `x-nonce` the visitor sent deleted, then `Content-Security-Policy` set to the page policy below, so Next.js reads our nonce and never one the visitor chose.
4. `NextResponse.next({ request: { headers } })`, with the page header set (below) put on the response.

Page policy, from `pagePolicy(nonce, dev = false)` in `src/visitor/headers.ts` (it throws on a nonce that is not 22 base64 characters plus `==`), one line:

```
default-src 'none'; script-src 'self' 'nonce-{nonce}'; style-src 'self' 'nonce-{nonce}'; img-src 'self'; media-src 'self'; font-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'
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
| `POST /l/{slug}/enter`, `/leave`, `/reviewer`, `/signoffs`, `/signoffs/{id}/remove` | `app/[[...path]]/route.ts` | Route handler (catch-all) | `createApp` → `visitor/routes.ts` | `303`, or the `403` plain text reply (`spec/approvals-service-visitor.md`, "Visitor routes and logic") |
| `GET /l/{slug}/p/{variantKey}/{version}` | the same | Route handler | `picture-route.ts` | The picture as a stream, or `404` with an empty body |
| `GET /l/{slug}/c/{variantKey}/{version}` | the same | Route handler | `clip-route.ts` | One byte range of the video clip (`206`, at most 4 MiB), or `404` with an empty body (`spec/phases/round-2-approvals-video.md`, "The clip route") |
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

The user's rule for all UI: modular components styled from one set of tokens that can be changed in one place. Plain, clean, readable on a phone. No UI library. Styling with **CSS Modules** (one `.module.css` per component; Next.js builds them into files served from our own address, which the policy allows). Three global stylesheets, imported once by `app/layout.tsx` in this order: `src/ui/app-tokens.css`, `src/ui/gallery-tokens.css`, `src/ui/base.css`. No component holds a colour, size or font of its own: every value is a `var(--…)` from the tokens. `test/tokens.test.ts` checks the order, that every gallery token is built on an app token or a fixed size, and that every component sheet and `base.css` read only app or gallery tokens.

### Tokens

- **`src/ui/app-tokens.css`**: a byte-for-byte copy of the app's `src/renderer/ui/tokens.css`. The root test `tests/unit/config/approvals-tokens.test.ts` fails when the two differ. The values live in the app's file only; none is written here.
- **`src/ui/gallery-tokens.css`**: the few sizes only the gallery needs, each built on an app token or a fixed size.
- **`src/ui/base.css`**: the page's base rules (font, page colours), from tokens only.

Buttons and fields are 44 px tall with 16 px text, easy to tap on a phone.

### Components (`src/ui/{name}/{name}.tsx` and `{name}.module.css`; server components except `gallery-script`)

| Component | Props | What it draws |
|---|---|---|
| `page-shell` | `children`, `side?` | The page's `<main>`, centred and at most `--width-wide` wide. With `side` (the gallery's sidebar): two columns on a wide window, the side first in the page's order |
| `notice` | `tone: 'info' \| 'error'`, `children` | A box with `role="status"` (info) or `role="alert"` (error) |
| `button` | `children`, `look`, optional `label` | A submit `<button>`; `label` becomes its accessible name |
| `password-screen` | `slug`, `notice` | Heading, sentence, the error notice when set, `password-form`. No campaign name |
| `password-form` | `slug` | `<form method="post" action="/l/{slug}/enter">`, labelled password field, "Open" |
| `gallery-screen` | `view` | The sidebar (`reviewer-panel`), then the notice and the cards in `gallery-grid`, one per variant in gallery order, drawn from the view alone |
| `reviewer-panel` | the view's parts | The sidebar, first in the page's order: campaign title, instruction sentence, `reviewer-form`, `signoff-all`, `log-out-form` |
| `reviewer-form` | `slug`, `reviewer`, `stamp`, `notice` | The email every sign-off on the page uses; "Use this email" is its first submit button, so Enter in the field saves the email and never signs anything |
| `signoff-all` | the live, unsigned and video counts | "Sign off all…" and its confirmation; the confirmation sends the reviewer form with `all=1` and the page's stamp |
| `log-out-form` | `slug` | "Log out", posting to `/l/{slug}/leave`: ends the session and clears both cookies |
| `gallery-grid` | `children` | A masonry of as many columns as fit, so it holds one variant or hundreds |
| `variant-card` | `slug`, `variant`, `signoffs`, `reviewer`, `mine` | `<article id="v-{variantKey}">`: its state by edge, ground and words; `variant-picture`, title, size line, `card-signoff` or `signoff-tick`; its `lightbox` inside it and outside every form |
| `variant-picture` | the slug, the variant | A button that opens the card's lightbox; inside it the picture (`/l/{slug}/p/{variantKey}/{version}`, lazy, empty `alt`, with width and height), or the expiry box; `video-mark` for a video |
| `video-mark` | `durationMs` | On the picture's corner: a play triangle and the clip's length, or "still only" |
| `card-signoff` | `slug`, `variantKey`, `version`, `title` | A card's sign-off button; it sends the reviewer form to the sign-off route |
| `signoff-tick` | `variantKey` | The green tick of a card this reviewer signed off; it opens the lightbox |
| `lightbox` | `slug`, `variant`, `signoffs`, `reviewer` | A `<dialog>` with `lightbox-media`, the sign-off button and the current version's sign-offs, each with "Remove" |
| `lightbox-media` | `slug`, `variant` | The large picture, the video player (preload none) or the expiry sentence |
| `gallery-script` | none | The page's one script of our own (see "Script", above); draws nothing |

- `src/ui/format-date.ts`: `YYYY-MM-DD HH:MM UTC` from milliseconds. `picture-size.ts`: a picture's width and height from its size line. `clip-length.ts`: a clip's length as text.
- Every value from outside our code (campaign name, titles, size lines, emails) is drawn as a React text child, which React escapes. No `dangerouslySetInnerHTML` anywhere (`test/config.test.ts` fails on it). Every `action` and `src` is built only from the checked slug, a variant key from the view and a whole number.
- `app/layout.tsx`: `<html lang="en">`, `<meta name="referrer" content="same-origin">`, `<meta name="robots" content="noindex, nofollow">`, the three global stylesheets, a plain `<body>` (`base.css` styles it).
- Each page sets its `<title>` with a React `<title>` element (React 19 moves it into the head).

### Words

**Password page.** Title "Review campaign". Heading "Review campaign". Text "Enter the password you were given." Field label "Password" (`type="password"`, `name="password"`, `autocomplete="current-password"`, `required`). Button "Open". After a failed try, above the form (error tone): "That password did not work. If you have tried many times, wait 15 minutes and try again." No campaign name, since the visitor has not proven anything yet.

**Gallery page.** Title: the campaign name. The words of the sidebar, the cards, the lightbox and "Sign off all" are in `spec/phases/round-2-approvals.md` ("The page", "The sidebar", "The cards", "The lightbox", "Sign off all") and, for video, `round-2-approvals-video.md`. The notices for `m` are in `src/visitor/notices.ts` (`spec/approvals-service-visitor.md`, "Notices"): `bad-email` and `email-saved` show in the sidebar by the reviewer form, every other gallery notice heads the main column.

**Not found:** "Not found." **Error:** "Something went wrong. Try again later."

## Tests

| File | What it proves |
|---|---|
| `test/ui.test.tsx` (Vitest, `react-dom/server` `renderToStaticMarkup`) | One table over the components: a campaign name, title, size line and email holding `<script>`, `"`, `'`, `&` and `</style>` appear only escaped; the password page; the picture and the expired box; the date format; the error components show only the fixed sentence |
| `test/ui-gallery.test.tsx`, `ui-sidebar.test.tsx`, `ui-lightbox.test.tsx`, `ui-video.test.tsx` | The gallery screen, the sidebar, the lightbox and the video parts |
| `test/gallery-script.test.ts` | The arrow keys, the command fallback, the masonry spans and the video pause |
| `test/tokens.test.ts` | The global stylesheets and their order; components read only tokens |
| `e2e/build.spec.ts` | No prerendered route under `/l` |
| `e2e/gallery.spec.ts` (Chromium, against `next start`, every address `http://localhost:{port}`, never `127.0.0.1`: the form Origin check is not loosened for it, `spec/approvals-service-visitor.md` "Forms that write") | (1) An unknown slug and a real slug without a session give the same status and the same body once nonces are set aside; the header list equals the page set plus the allow-list in `spec/approvals-service.md` (`vary` and `content-encoding` included); no `Set-Cookie`. (2) A wrong password, then the right one: the notice, then the gallery in order with its pictures loaded from the test picture server; the cookie's attribute text exact. (3) With JavaScript switched off in the browser: sign off, see the notice and the email; remove it; leave and land on the password page. (4) With JavaScript on, the same flow reports no policy refusal. (5) `/l/short` and `/l/%41aaaaaaaaaaa` give the plain 404. (6) Every reply in the flow is `no-store`, none `public` or `s-maxage`; every page reply carries the page policy with a new nonce each time |
| `e2e/lightbox.spec.ts` | The lightbox opens, closes, holds focus and moves between cards; masonry spans; script off; a video pauses on close; a failed clip's notice |
| `e2e/clips.spec.ts` | The clip route answers ranges for a session only; the page loads only its own clips; a player loads nothing before play; a missing clip gets the empty 404 |
| `e2e/pictures/pictures.spec.ts` | Pictures pass only for a session, typed by the sniff |
| `e2e/shots.spec.ts`, `shots-r2.spec.ts`, `shots-r2v.spec.ts` | The screenshots below |

**Screenshots for the user** (D-084 range 90 to 99), by `npm run test:e2e -- e2e/shots-r2.spec.ts` (and the other two shot files) against `next start`, written to the root `shots/` folder (not in git). Each shot's name is set in its spec file.
