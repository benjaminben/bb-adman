// A tool of the Phase 10 plan that is not built yet (spec/phases/phase-10.md, A-230). It is in
// ALL_TOOLS but not in MCP_TOOLS, so it is never listed to an agent, and a call to its name is
// answered as an unknown tool. The slice that owns its group file replaces it with a full row.
import { z } from 'zod'
import type { ToolDef } from './table'

export function notBuilt(name: string, kind: ToolDef['kind'], target: string): ToolDef {
  return { name, description: 'Not built yet.', kind, target, input: z.object({}), notBuilt: true }
}
