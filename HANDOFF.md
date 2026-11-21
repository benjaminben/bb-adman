# AP-15 handoff

Status: **done**, waiting on the security review.

## Done (committed)
- `src/visitor/notices.ts`: the fixed table, `NoticeKey`, `noticeOn(page, m)`.
- `src/visitor/headers.ts`: `textHeaders`, `pagePolicy(nonce, dev = false)`, `pageHeaders(request, nonce, dev = false)`, `textReply`, `notFound`, `refused`. `redirect(request, slug, { m?, cookie? })` builds the address itself from a slug that passes `Slug` (otherwise it throws) and a `NoticeKey`.
- `src/visitor/actions.ts`: `openGallery(db, { slug, cookie, m }, now)` gives `{ kind: 'password', notice }` or `{ kind: 'gallery', view }`. The view has `notice` instead of `m`. Enter and leave results no longer carry `location`.
- `src/visitor/session.ts`: `readSession(db, cookie, slug, now)`.
- `src/visitor/routes.ts`: replies are only plain text and `303`s. A failed entry is the `303` to `/l/{slug}?m=wrong-password`. The `gallery` and `stylesheet` rows are gone.
- `src/server/env.ts`: `isDev(source = process.env)`.
- Removed: `html.ts`, `password-page.ts`, `gallery-page.ts`, `styles.ts`, `test/pages.test.ts`.

## Left
- Nothing in AP-15. AP-16's `proxy.ts` imports `isDev` from `src/server/env.ts` and passes it to `pageHeaders` / `pagePolicy`.

## Decisions
- `redirect` takes the slug rather than an address, so no caller can hand it request text.
- `pagePolicy` takes a `dev` flag. `env.ts` is the one reader of `NODE_ENV` (coordinator ruling).
- The no-database 500 test in `entry.test.ts` now posts to `/enter`, because `GET /l/{slug}` no longer reaches the database.
- `visitor-setup.ts` `enter()` now also requires `Location: /l/{slug}` and a `Set-Cookie`, because a failure is a `303` too.

## Open questions
- None.

## Verify
```
cd approvals-service
npm install
npm run typecheck
npm test
NEXT_TELEMETRY_DISABLED=1 npm run build
NEXT_TELEMETRY_DISABLED=1 npm run test:e2e
```
