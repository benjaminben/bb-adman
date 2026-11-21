# Approvals service: visitor routes, sessions, forms, pictures

The visitor's side of the approvals service [D-095, D-097]: the routes the catch-all answers for a visitor, sessions and the cookie, the gallery view, the try limit, the forms that write, notices, header sets, and pictures. The pages themselves are in `spec/approvals-gallery.md`. Read with `spec/approvals-service.md` (how Next.js fits, environment) and `spec/approvals-service-data.md` (the contract, the database). Slices: `spec/phases/approvals-service-slices.md`.

## Visitor routes and logic

The logic is **Built** (AP-3, with its review's fixes); the replies for the page app are **built** (AP-15); sign-off and pictures are AP-4. The pages themselves are in `spec/approvals-gallery.md`. **The try limit, the session check and the form checks live only here**, never in `proxy.ts` or a page.

**Routes through the catch-all** (`visitor/routes.ts`; the table `VISITOR_ROUTES` of `{ name, method, path, handler }`, matched on the raw path of `request.url`, so a percent-encoded character never matches a slug):

| Route | What it does |
|-------|--------------|
| `POST /l/{slug}/enter` | Form `password`. Right: session made, cookie set, `303` to `/l/{slug}`. Wrong, unknown slug or too many tries: `303` to `/l/{slug}?m=wrong-password`, the same bytes in all three cases (A-103) |
| `POST /l/{slug}/signoffs` | Form `variant`, `version`, `email`. Adds a sign-off (AP-4). `303` to `/l/{slug}?m={code}#v-{variant}` |
| `POST /l/{slug}/signoffs/{id}/remove` | Removes that sign-off if it belongs to this link (AP-4). `303` as above |
| `POST /l/{slug}/leave` | Deletes this session's row, clears the cookie, `303` to `/l/{slug}`. No valid session: the plain-text `403` |
| `GET /l/{slug}/p/{variantKey}/{version}` | The picture, for a valid session only ("Pictures", below, AP-4) |
| `GET /robots.txt` | `User-agent: *` and `Disallow: /` |
| Anything else (not the page) | `404`, "Not found.", with the plain text headers below |

- Each handler call is wrapped: a throw logs the route name and the error's name only, and answers the fixed `500` "Something went wrong. Try again later." with the plain text headers.
- **Every redirect is a `303`** built by `redirect(request, slug, { m?, cookie? })` in `headers.ts` from the checked slug (never Next.js's `redirect()`, which may send a 307 that makes the browser post again). Its headers are the plain text set plus `Location` and, when entering or leaving, `Set-Cookie`. AP-4's sign-off redirect with `#v-{variant}` goes through it too, with a checked variant option. It throws on an unknown notice key.
- **`NODE_ENV` is read only in `src/server/env.ts`**, which exports `isDev()`. Nothing else reads it.
- **The cookie is set and cleared only here**, never by a page or by `proxy.ts`.

### Session

**Built.**

- **Cookie.** Name `__Host-adman-{slug}`; value the 43-character token; attributes exactly `Path=/; Max-Age=43200; HttpOnly; Secure; SameSite=Lax`, no `Domain`. `Secure` is kept on local runs too (`http://localhost` counts as a secure place in Chromium, and the local runs use `localhost`, `spec/approvals-service.md` "Running it locally"; AP-13 checks it). The `__Host-` prefix makes the browser refuse the cookie unless it is `Secure`, has `Path=/` and no `Domain`, so no other site or sub-domain can plant one. Each link has its own cookie name, so one link's session never opens another.
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

**Built** (AP-3 review fix; the new input AP-15, built). `openGallery` gives `{ kind: 'password', notice }` or `{ kind: 'gallery', view }`, and the view is built field by field:

```ts
type GalleryView = {
  link: { slug: string; campaignName: string }
  variants: Array<{ variantKey: string; position: number; title: string; sizeLine: string; version: number; expired: boolean }>
  signoffs: Array<{ id: string; variantKey: string; version: number; email: string; createdAt: number }>
  notice: NoticeKey | null
}
```

- Raw rows (`LinkRow`, `VariantRow`, `SignoffRow`) never leave `src/visitor/` and `src/db/`. The view holds no hash, salt, internal link ID, picture address or expiry time. Only this type may be passed to a component; nothing under `app/` or `src/ui/` imports a row type or a module from `src/db/` or `src/crypto/` (`test/config.test.ts` checks the imports).
- **AP-15 changed the input** from a `Request` to what a page has: `openGallery(db, { slug, cookie, m }, now)`, where `cookie` is the `Cookie` header text or null and `m` the `m` query value or null. `readSession` takes the cookie text the same way.

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
- **Why the Origin check holds on Vercel.** `request.url` there is built from the host the browser used. A forged post comes from the visitor's own browser, which sets `Origin` to the other site and `Host` to ours, so the two never match. If `request.url` were ever wrong, every form would be refused: it fails closed, and `e2e/gallery.spec.ts` and AP-13's hand check prove the forms work.
- **The rule for the Origin check.** It is never loosened. It never reads `X-Forwarded-Host`. It never allows a second origin to make a test pass. On local `next start`, `request.url` is `http://localhost:{port}`, so every e2e test opens the service at `http://localhost:{port}` (`spec/approvals-service-tests.md`), never at `127.0.0.1`.

**Sign off** (`visitor/signoffs.ts`, AP-4). `variant` must match `VARIANT_KEY`, `version` a whole number, `email` must pass `EMAIL` (else `m=bad-email`). Then one statement that writes only if the variant still exists for this link at this version:

```sql
INSERT OR IGNORE INTO signoff (id, link_id, variant_key, version, email, created_at)
SELECT ?1, link_id, variant_key, version, ?2, ?3
FROM gallery_variant WHERE link_id = ?4 AND variant_key = ?5 AND version = ?6
```

One row written: `m=signed`. None: if a sign-off with that link, variant, version and email exists, it was a repeat (`m=signed`); otherwise the variant changed or went (`m=changed`).

**Remove** (AP-4): `DELETE FROM signoff WHERE id = ? AND link_id = ?`. An ID of another link removes nothing. `m=removed` either way (anyone with the link may remove any sign-off [D-095]).

### Notices

**Built (AP-15)**, `visitor/notices.ts`. `m` is looked up in this fixed table and becomes a `NoticeKey`; an unknown value is null. A page never shows text from the address.

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
Referrer-Policy: same-origin
Cross-Origin-Opener-Policy: same-origin
Cache-Control: no-store
X-Robots-Tag: noindex, nofollow
Strict-Transport-Security: max-age=31536000        (only when the request is https)
```

`Referrer-Policy: same-origin` keeps the slug from leaving in a `Referer` header: a request to any other site carries no referrer. It is not `no-referrer`, because under that setting a browser sends `Origin: null` on a form post, and the Origin check of "Forms that write" would refuse every real form. Under `same-origin` the service's own forms carry its origin, and the Origin check itself is unchanged. One test compares each header set whole. Next.js may add `Vary` and `Content-Encoding` to these replies (`spec/approvals-service.md`, "What Vercel and Next.js add or change in front").

## Pictures

**Built (AP-4).** `src/pictures/`. The service never stores picture bytes.

- **`PictureSource`** (`source.ts`) is the one interface the picture route uses: `get(ref: { url: string }): Promise<{ bytes: Uint8Array; type: 'image/png' | 'image/jpeg' } | null>`. `s3-source.ts` is today's only implementation.
- **`checkPictureUrl(text, env)`** (`check-url.ts`), used when the API stores an address and again right before every fetch:
  - `https:` only; no user name or password; no port, or port 443;
  - host, lower-cased, matching `^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]\.s3\.[a-z0-9-]+\.amazonaws\.com$` (a bucket's own host) or `^s3\.[a-z0-9-]+\.amazonaws\.com$` (path style), the two forms the app's S3 client makes (`spec/storage-and-publish.md`, "Allowed hosts");
  - **test origin:** only when the environment has `TEST_PICTURE_ORIGIN` (never on a Vercel deployment, `spec/approvals-service.md` "Environment") and that value is exactly `http://127.0.0.1:{port}`, an address with that exact origin is also allowed.
- **Fetching** (`s3-source.ts`): the stored text is parsed once into a `URL`; `checkPictureUrl` runs on it; the same `URL` object is fetched with `fetch(url, { redirect: 'manual' })` and no added header, no cookie and nothing from the visitor's request. Under Node a redirect comes back as its real 3xx status. Status must be 200: anything else is a failure. `Content-Length` over 16 MiB fails before reading; the body is read with a 16 MiB cap; the first bytes must be a PNG (`89 50 4E 47 0D 0A 1A 0A`) or a JPEG (`FF D8 FF`) (`sniff.ts`). The reply's own `Content-Type` is ignored.
- **The picture route.** Session check; the row `gallery_variant` for (this link, `variantKey`); `version` must equal the row's; `picture_expires_at` after now; then `PictureSource.get`. Any failure: `404` with an empty body and the plain text headers. Success: the checked bytes sent as a stream (a `ReadableStream` that hands over the buffer in 1 MiB pieces, so Vercel's 4.5 MB limit on whole replies does not apply; every check has passed before the first byte), with `Content-Type` from the sniff, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store` (the browser keeps no copy, so a reload always shows the current picture and nothing stays after "Leave"), `Content-Security-Policy: default-src 'none'; sandbox`, `Cross-Origin-Resource-Policy: same-origin`, `Referrer-Policy: no-referrer`.
- **The stored address never appears** in a reply, a log line or an error.
- **An expired address.** Signed S3 addresses last at most 7 days. The app renews them when it refreshes (`spec/approvals-commands.md`, "`approvals.refresh`"). The gallery shows the expiry sentence for a row whose time has passed. A picture that fails before its time shows the browser's broken picture with its `alt` text; the next "Update gallery" fixes it.
