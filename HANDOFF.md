# AP-4 handoff — sign-offs and pictures

Status: done. All of the slice is built; nothing in progress.

## Done
- `redirect` takes a checked `variant` (`#v-{variant}`), throws on a bad shape; `pictureHeaders`,
  `emptyNotFound` in `src/visitor/headers.ts` (tests in `test/headers.test.ts`).
- Sign off and Remove: `src/visitor/signoffs.ts`, `src/db/signoffs.ts` (`addSignoffIfVariant`,
  `hasSignoff`, `removeSignoffOf`), wired in `src/visitor/routes.ts`. Tests:
  `test/signoffs.test.ts`, the two routes added to `test/forms.test.ts`.
- Pictures: `src/pictures/source.ts`, `sniff.ts`, `s3-source.ts`, `src/visitor/picture-route.ts`;
  default source made in `createApp` (`src/app.ts`). Tests: `test/picture-route.test.ts`, with
  a local Node server standing in for S3.
- Playwright: `e2e/pictures/serve.ts` is `globalSetup` (static server on 127.0.0.1, fixed names
  only); `playwright.config.ts` picks its port and passes `TEST_PICTURE_ORIGIN`;
  `e2e/pictures/pictures.spec.ts` runs the chain under `next start`. `a.png`, `b.png` made with
  Node's zlib, `c.jpg` converted from a PNG with macOS `sips`; nothing downloaded.

## Left
- Nothing in this slice. AP-16 builds the pages.

## Decisions
- Remove: `DELETE … WHERE id = ? AND link_id = ? RETURNING variant_key`, so the 303 can carry
  `#v-{variant}`; no fragment when nothing was removed.
- Sign off with a variant of the wrong shape: `m=changed`, no fragment. A bad version:
  `m=changed#v-{variant}`. Missing email: `m=bad-email`.
- s3-source re-checks with `checkPictureUrl(url.href, env) === url.href` on the one parsed `URL`,
  then fetches that object (check-url.ts is not this slice's file).
- No `cache` option on the fetch: the Fetch standard makes `no-store` add Pragma and
  Cache-Control headers (test proves no extra header).
- Picture header set is exactly the six of the spec (no HSTS, no X-Frame-Options).

## Open questions
- See the final report.

## Verify
```
npm run lint                       # root
cd approvals-service
npm run typecheck && npm test && npm run build && npm run test:e2e
```
