# AP-4 handoff — sign-offs and pictures

## Done
- `redirect` takes a checked `variant` (`#v-{variant}`), throws on a bad shape; `pictureHeaders`,
  `emptyNotFound` in `src/visitor/headers.ts` (tests in `test/headers.test.ts`).
- Sign off and Remove: `src/visitor/signoffs.ts`, `src/db/signoffs.ts` (`addSignoffIfVariant`,
  `hasSignoff`, `removeSignoffOf`), wired in `src/visitor/routes.ts`. Tests:
  `test/signoffs.test.ts`, the two routes added to `test/forms.test.ts`.

## In progress
- Pictures: `src/pictures/source.ts`, `sniff.ts`, `s3-source.ts`, `src/visitor/picture-route.ts`,
  `test/picture-route.test.ts`.

## Left
- Default `PictureSource` in `src/app.ts`; Playwright picture server; `e2e/pictures/`.
- Final run: root `npm run lint`; in `approvals-service/`: typecheck, test, build, test:e2e.

## Decisions
- Remove: `DELETE … WHERE id = ? AND link_id = ? RETURNING variant_key`, so the 303 can carry
  `#v-{variant}`; no fragment when nothing was removed.
- Sign off with a variant of the wrong shape: `m=changed`, no fragment. A bad version:
  `m=changed#v-{variant}`.

## Open questions
- See the final report.

## Verify
```
cd approvals-service
npx vitest run test/headers.test.ts test/signoffs.test.ts test/forms.test.ts
npm run typecheck && npm test
```
