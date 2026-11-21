# P4-T3 handoff

## Done
- Fix 1: campaign tab marks follow job.updated (use-project.ts); unit test use-project.test.tsx; e2e fixme removed.
- Fix 2: Place text with AI finish step (layout-run.ts applyLayout) sends job.markSeen once the result is on the layers; tests in layout-run.test.tsx; workflow 5.1 e2e checks seenAt.
- Fix 3: usePalette (the one source of every swatch) drops entries that are not exact #RRGGBB; test use-palette.test.tsx.
- Fix 4: app-shell.module.css gives the main cell a right margin of the panel width while the Activity panel is open (:has); e2e check in workflow-5-1 step 3 test; shot 131 checked.

## Follow-ups (done)
- Layout result marked seen once handled, also when layer.updateMany or variant.get is refused (ruling).
- cut-out-status.tsx keeps its held row on an updatedAt tie (>=); test cut-out-status.test.tsx; workflow-5-1.spec.ts 10/10 runs passed.

## In progress / left
- nothing. Full run done: lint, typecheck clean; npm test 613 files / 6490 tests, exit 0; build ok; test:build 8/8; test:e2e 63 passed, 1 flake (workflow 5.1 cut-out step) that passes alone and also flakes on main (1 in 14).

## Decisions
- Fix 1: re-read only when a job of one of this project's campaigns changes mark (active / unseen / neither); first event for a job always re-reads.
- Fix 2: the brief named layout-dialog/, but that is the starter "Layout…" dialog (no job). The Place text with AI result is shown by the finish step in layout-run.ts, so the mark is sent there: after layer.updateMany succeeds, or when the result changes no layer. Not sent when the apply is refused (incl. deleted variant).

## Open questions
- none

## Verify
npm run shots  (look at shots/131-workflow-5-8-new-result.png)
npx vitest run tests/unit/renderer/editor/use-palette.test.tsx
npx vitest run tests/unit/renderer/editor/layout-run.test.tsx
npx vitest run tests/unit/renderer/screens/project-home/use-project.test.tsx
npm run build && npx playwright test tests/e2e/workflow-5-1.spec.ts -g "5.8"
