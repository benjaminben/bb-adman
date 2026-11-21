# AP-15 handoff

Status: **blocked**. The rest of the slice needs edits to three test files outside the slice's "may touch" list.

## Done (committed)
- `src/visitor/notices.ts`: the fixed table, `NoticeKey`, `noticeOn(page, m)` (own key only, page must match). Tested in `test/view.test.ts`.
- `src/visitor/headers.ts`: `pagePolicy(nonce, dev = false)`, `pageHeaders(request, nonce)`, `textReply`, `notFound(request)` with the plain text set. Tested in `test/headers.test.ts`.
- `src/visitor/routes.ts`: the 404, 500 and robots replies use `textReply` / `notFound`.

## Left (blocked)
1. Failed entry becomes `303` to `/l/{slug}?m=wrong-password` (built from the checked slug); the throttle test's byte-equal check moves to the three `303`s.
2. `403` and every `303` use the plain text set (add `refused(request)` to `headers.ts`; `redirect` uses `textHeaders`). Add these whole-set cases back to `test/headers.test.ts`.
3. `openGallery(db, { slug, cookie, m }, now)` gives `{ kind: 'password', notice }` / `{ kind: 'gallery', view }` with `view.notice` from `noticeOn`; `readSession(db, cookie, slug, now)`.
4. Remove `html.ts`, `password-page.ts`, `gallery-page.ts`, `styles.ts`, `test/pages.test.ts`, the `gallery` and `stylesheet` routes, `htmlReply` and `stylesheetHeaders`.

## Why blocked: test files outside the list that must change
- `test/actions.test.ts`: calls `openGallery(db, Request, slug, now)` and expects `m: 'signed'` in the view.
- `test/session-ends.test.ts`: imports `FAILURE` from `password-page.ts`; expects `/enter` to answer 200 with the failure page; reads gallery HTML from `GET /l/{slug}`.
- `e2e/api.spec.ts` "an rsc: 1 header reaches no data": expects a 200 HTML password page at `/l/{slug}`, which becomes the plain 404.

## Decisions
- `pagePolicy` takes a `dev` flag rather than reading `NODE_ENV`: `test/config.test.ts` allows `process.env` in four files only. With one argument it gives the strict policy.
- The 303/403 switch is kept for the unit that removes the HTML, so `test/pages.test.ts` keeps covering the HTML while it is still served.

## Open questions
- Which file reads `NODE_ENV` for the page policy's dev additions, given `proxy.ts` (AP-16) is not one of the four files allowed to read `process.env`?

## Verify
```
cd approvals-service
npm install
npm run typecheck
npm test
NEXT_TELEMETRY_DISABLED=1 npm run build
NEXT_TELEMETRY_DISABLED=1 npm run test:e2e
```
