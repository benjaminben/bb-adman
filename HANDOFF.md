# AP-8 handoff: link commands and the queries

## Done

- `src/main/approvals/local-store.ts`: the one reader and writer of the three approvals tables; every row read is checked with the contract's rules, a bad row is skipped and logged by table and campaign ID.
- `approvals.createLink`, `approvals.setPassword`, `approvals.endLink`, `approvals.forCampaign`, `approvals.getPassword`.
- `src/main/commands/approvals/password-input.ts`: the command input that lets the password through so the command refuses a bad one with the spec's sentence.
- `deps.approvals.changed` (in AP-5's `types.ts` and `deps.ts`, separate commit): sends `approvals.changed`. Needs the orchestrator's approval.

- Review round: `PasswordStore.canKeep` (AP-6's `password-store.ts`, `types.ts`) asked before the first request; `setPassword` sends `approvals.changed`; the event and endLink's `forget` run after the commit (`src/main/approvals/after-commit.ts`); test gaps C5 to C8 closed (`two-projects.test.ts`).

## In progress

Nothing.

## Left

Nothing in AP-8. AP-9 adds the publish and refresh writes to `local-store.ts`.

## Decisions

- The password is checked before the shared refusals (it is input checking).
- `setPassword` on a link the service no longer has: `approval_link_gone`, nothing changed locally.
- `setPassword` sends `approvals.changed` (ruled: `passwordKept` may change).
- After-commit work is a microtask queued in `run` that first re-reads the local rows to confirm the commit.
- `forCampaign` refuses an unknown campaign (`NOT_FOUND`); `getPassword` does not look at the campaign.
- `createdAt` of a taken-over link is the time of the take-over (spec step 3, "now").

## Open questions

See the AP-8 report.

## Verify

```
npx vitest run tests/unit/main/approvals/local-store.test.ts tests/integration/approvals
npm run lint && npm run typecheck && npm test && npm run build && npm run test:build
```
