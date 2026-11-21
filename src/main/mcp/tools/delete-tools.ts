// delete_campaign (spec/phases/phase-10.md, ask flow; D-023). Not built: P10-6 replaces this row.
import { notBuilt } from './not-built'
import type { ToolDef } from './table'

export const DELETE_TOOLS: readonly ToolDef[] = [
  notBuilt('delete_campaign', 'command', 'campaign.delete'),
]
