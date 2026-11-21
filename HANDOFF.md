# SP-6 handoff: blocked

## Done
- Nothing built. Stopped before any code or test change.

## Blocker
`src/main/mcp/tools/table.ts` line 83 gives `create_campaign` the same schema as the command: `input: campaignCreateInput`. `src/main/mcp/tools/index.ts` builds the tool's input from `def.input.shape`. Adding `placeSubjectPhoto` to `campaignCreateInput` (as the slice requires) therefore also offers it on `create_campaign` (breaks A-122 and the pinned MCP tool-list snapshot). Keeping the tool without the field needs a change to `table.ts`, which SP-6 may not touch.

zod 4.6.7: `.omit()` throws on an object with refinements; `.extend()` and `.safeExtend()` work.

## Proposed fix (needs a ruling)
- `campaign.ts`: build the fields as a plain object, export `campaignCreateInput` (with `placeSubjectPhoto?: boolean`, same refinements) and a second schema for the tool without it, e.g. `campaignCreateToolInput`.
- `table.ts` (add to SP-6's "May touch"): `input: campaignCreateToolInput`.
- `fills.ts`: `slotFills` skips `subject-image` when `placeSubjectPhoto === false`; `create.ts` passes it through.

## Left
- The whole slice, once the ruling is in.

## Verify
- `npx vitest run tests/integration/campaigns/campaign-create*.test.ts tests/integration/mcp/tool-list.test.ts tests/unit/shared/schemas/contracts.test.ts`
- `npm run lint`, `npm run typecheck`, `npm test`
