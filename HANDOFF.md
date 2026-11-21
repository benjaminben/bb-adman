# AP-9 handoff — Update gallery and refresh

## Done
- `local-store.ts`: `publishLocalGallery` and `refreshLocalLink` (tables keep their one owner; file outside the slice's list, flagged)

## In progress
- `approvals.publish`

## Left
- `approvals.refresh` (with `renew.ts`), schema `gone: boolean`
- `picture-paths.test.ts` (isolation over publish and end), secrets-in-log test
- lint, typecheck, full test run

## Decisions
- Table writes added to `src/main/approvals/local-store.ts` (not in the slice's list) because the spec makes it the only code that writes the approvals tables.

## Open questions
- (none yet)

## Verify
```
npx vitest run tests/unit/main/approvals/local-store.test.ts
npm run lint && npm run typecheck && npm test
```
