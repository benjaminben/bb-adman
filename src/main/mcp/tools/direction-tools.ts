// create_direction, rename_direction and delete_direction (spec/mcp-and-agents.md,
// "Directions"; D-105; FR-072, FR-074). An agent reads a campaign's directions with
// get_campaign. create_direction is direction.createFromMaster: a copy of a master becomes the
// master of a new direction; it has no undo (D-099). rename_direction is direction.rename, on
// the campaign's undo list. delete_direction is direction.delete, policy ask: the bus asks the
// user and the call waits; it has no undo. Each reply holds IDs only. Listed last (table.ts).
import {
  directionCreateFromMasterInput,
  directionDeleteInput,
  directionRenameInput,
} from '@/shared/schemas/commands/direction'
import type { ReplyPicker } from './read-replies'
import type { ToolDef } from './table'

const madeIds: ReplyPicker = (data) => {
  const made = data as { directionId: string; variantId: string }
  return { directionId: made.directionId, variantId: made.variantId }
}

const directionIdOnly: ReplyPicker = (data) => ({
  directionId: (data as { directionId: string }).directionId,
})

export const DIRECTION_TOOLS: readonly ToolDef[] = [
  {
    name: 'create_direction',
    description:
      'Add a creative direction to a campaign of an open project, as a copy of a master ' +
      'variant: give the masterVariantId of an existing direction, from get_campaign. The ' +
      "copy becomes the new direction's master. The name must differ from the campaign's " +
      'other directions. This cannot be undone; delete a direction that is not wanted. ' +
      'Gives the new direction ID and the ID of its master variant.',
    kind: 'command',
    target: 'direction.createFromMaster',
    input: directionCreateFromMasterInput,
    reply: madeIds,
  },
  {
    name: 'rename_direction',
    description:
      "Rename a direction of an open project. The name must differ from the campaign's " +
      'other directions. The user can undo it. Gives the direction ID.',
    kind: 'command',
    target: 'direction.rename',
    input: directionRenameInput,
    reply: directionIdOnly,
  },
  {
    name: 'delete_direction',
    description:
      'Delete a direction of an open project, with all its variants and their layers. A ' +
      'campaign keeps at least one direction. This cannot be undone. It also empties the ' +
      "undo list of its whole campaign, so the campaign's earlier changes can no longer be " +
      'undone either. The user is asked in the app, and this call waits up to two minutes ' +
      'for the answer. A refusal is final: do not ask again for the same direction unless ' +
      'the user tells you to.',
    kind: 'command',
    target: 'direction.delete',
    input: directionDeleteInput,
    reply: directionIdOnly,
  },
]
