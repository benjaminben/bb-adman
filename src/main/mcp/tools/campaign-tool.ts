// create_campaign (SPEC 4.5; spec/mcp-and-agents.md, the tool table; A-246, OI-25). Sizes and
// languages may be left out: prepareInput fills them from the brief, else the three default
// sizes and the region's language, and campaign.create checks the whole input as before. The
// reply is the three IDs, through createdFields.
import { campaignCreateAgentInput } from '@/shared/schemas/commands/campaign-agent'
import { fillCreateDefaults } from '@/shared/campaign/create-defaults'
import { createdFields } from './campaign-replies'
import type { ToolDef } from './table'

export const CAMPAIGN_TOOLS: readonly ToolDef[] = [
  {
    name: 'create_campaign',
    description:
      'Create a campaign in an open project from a confirmed brief, with one subject_map ' +
      'entry per brief subject. sizes and languages may be left out: the brief’s own are ' +
      'used, else the sizes 1x1, 9x16 and 16x9 and the main language of the brief’s region. ' +
      'Gives the new campaign ID, its first direction ID and its master variant ID.',
    kind: 'command',
    target: 'campaign.create',
    input: campaignCreateAgentInput,
    prepareInput: fillCreateDefaults,
    reply: createdFields,
  },
]
