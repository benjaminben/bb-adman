# AP-9 handoff — Update gallery and refresh

## Done
- `local-store.ts`: `publishLocalGallery`, `refreshLocalLink` (outside the slice's list; the spec makes it the one writer of the approvals tables)
- `approvals.publish`: `src/main/approvals/publish.ts`, `src/main/commands/approvals/publish.ts`
- `approvals.refresh`: `src/main/approvals/refresh.ts`, `renew.ts`, `src/main/commands/approvals/refresh.ts`; reply gains `gone`
- Tests: `publish.test.ts`, `refresh.test.ts`, `picture-paths.test.ts`, `publish-refresh-secrets.test.ts`, local-store unit additions; link-fixture helpers
- `stubs.test.ts`: the publish and refresh stub rows removed (AP-8 precedent)

## In progress
- nothing

## Left
- nothing in this slice; security review next

## Decisions
- Publish on a service `404`: `approval_link_gone`, this run's files removed, nothing changed locally (as AP-8's setPassword).
- Publish checks every value before any draw: variant IDs through `picturePath`, title, size line and campaign name through the contract's shown-text rules (INVALID_INPUT with the client's refusal sentence).
- A renewal whose count differs from what was sent counts as failed: no expiry recorded.
- Refresh on a gone link forgets the password before sending `approvals.changed` (both after the commit).
- The campaign.get order is repeated in `publish.ts` (`queries/approvals.ts` keeps its own private copy).

## Open questions
- See the report: local-store.ts edit, stubs.test.ts rows.

## Verify
```
npx vitest run tests/integration/approvals tests/unit/main/approvals
npm run lint && npm run typecheck && npm test
```
