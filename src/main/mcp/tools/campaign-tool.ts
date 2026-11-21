// create_campaign (SPEC 4.5; spec/mcp-and-agents.md, the tool table). Moved out of table.ts
// unchanged by P10-1; P10-10 owns this file (the fallback of A-246 and its reply picker).
import { campaignCreateToolInput } from '@/shared/schemas/commands/campaign'
import type { ToolDef } from './table'

export const CAMPAIGN_TOOLS: readonly ToolDef[] = [
  {
    name: 'create_campaign',
    description:
      'Create a campaign in an open project from a confirmed brief, with one subject_map ' +
      'entry per brief subject. Gives the new campaign ID and its master variant ID.',
    kind: 'command',
    target: 'campaign.create',
    input: campaignCreateToolInput,
  },
]
