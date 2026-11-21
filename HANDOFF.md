# AP-10 handoff

## Done
- `src/renderer/screens/settings/approvals-section/` (section, address form, CSS, index), mounted after Cloud storage.
- `tests/unit/renderer/screens/settings/approvals-section.test.tsx` (15 cases, axe included).

## In progress / left
- `tests/shots/ap-10.shots.ts`, picture `91-settings-approvals-service`.
- Full run: lint, typecheck, test, build, test:build, test:e2e, shots.

## Decisions
- `approvals.setService` input is `{ address }` (the schema), not `{ baseUrl }`.
- The key uses the existing KeyRow with a local ProviderInfo labelled "Service": the row reads "Service API key".
- Wording "runs on your own Vercel account", as the spec file has it.

## Verify
npx vitest run tests/unit/renderer/screens/settings/approvals-section.test.tsx
npx playwright test --config playwright.shots.config.ts tests/shots/ap-10.shots.ts
