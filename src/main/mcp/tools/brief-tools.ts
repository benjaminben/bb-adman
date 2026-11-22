// create_campaign_from_brief (spec/phases/round-2-platform.md, D6): a campaign from brief text.
// R2P-1 adds the row as notBuilt (A-230); R2P-7 fills it, with targets and pickTarget.
import { notBuilt } from './not-built'
import type { ToolDef } from './table'

export const BRIEF_TOOLS: readonly ToolDef[] = [
  notBuilt('create_campaign_from_brief', 'command', 'campaign.createFromBrief'),
]
