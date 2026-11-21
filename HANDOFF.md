# P4-T3 handoff

## Done
- Fix 1: campaign tab marks follow job.updated (use-project.ts); unit test use-project.test.tsx; e2e fixme removed.

## In progress / left
- Fix 2: layout dialog sends job.markSeen
- Fix 3: palette swatches only for exact #RRGGBB
- Fix 4: Activity panel covering the campaign page

## Decisions
- Fix 1: re-read only when a job of one of this project's campaigns changes mark (active / unseen / neither); first event for a job always re-reads.

## Open questions
- none yet

## Verify
npx vitest run tests/unit/renderer/screens/project-home/use-project.test.tsx
npm run build && npx playwright test tests/e2e/workflow-5-1.spec.ts -g "5.8"
