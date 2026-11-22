// delete_campaign (spec/phases/phase-10.md, ask flow; D-023, D-099). The command's policy is
// ask: the bus asks the user through the permission broker and the call waits for the answer.
// Deleting has no undo. The reply is the campaign ID only.
import { campaignDeleteInput } from '@/shared/schemas/commands/campaign-edit'
import type { ReplyPicker } from './read-replies'
import type { ToolDef } from './table'

const campaignIdOnly: ReplyPicker = (data) => ({
  campaignId: (data as { campaignId: string }).campaignId,
})

export const DELETE_TOOLS: readonly ToolDef[] = [
  {
    name: 'delete_campaign',
    description:
      'Delete a campaign of an open project, with its directions, variants, layers and ' +
      'reports. This cannot be undone. The user is asked in the app every time, and this ' +
      'call waits up to two minutes for the answer. A refusal is final: do not ask again ' +
      'for the same campaign unless the user tells you to.',
    kind: 'command',
    target: 'campaign.delete',
    input: campaignDeleteInput,
    reply: campaignIdOnly,
  },
]
