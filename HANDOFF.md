# SP-6 handoff

## Done
- `campaignCreateInput` has `placeSubjectPhoto?: boolean`; `campaignCreateToolInput` is the same schema without it, same two refinements (`src/shared/schemas/commands/campaign.ts`).
- `create_campaign` uses `campaignCreateToolInput` (`src/main/mcp/tools/table.ts`, ruled in by the coordinator).
- `slotFills` takes `placeSubjectPhoto` (default true); false leaves `subject-image` empty. `create.ts` passes it through.
- Tests: `campaign-create-fills.test.ts` (false / true / left out, with `template.slots` candidates), `contracts.test.ts` (boolean only; tool schema has no field, same refinements), `mcp/tools.test.ts` (tool schema has no field in either spelling; an agent call passing it, in either spelling, still fills the slot). Pinned tool-list snapshot unchanged.

## Decisions
- An agent passing the field: dropped, not refused. The MCP layer drops unknown keys before the handler runs (existing behaviour in `src/main/mcp/tools/index.ts`).

## In progress / left
- Nothing.

## Open questions
- None.

## Verify
- `npx vitest run tests/integration/campaigns/campaign-create tests/unit/shared/schemas/contracts.test.ts tests/integration/mcp/tools.test.ts tests/integration/mcp/tool-list.test.ts`
- `npm run lint`, `npm run typecheck`, `npm test`
