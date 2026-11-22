// add_variant and delete_variant (spec/phases/phase-10.md, the Phase 5 tools; spec/mcp-and-
// agents.md; FR-195, FR-197). add_variant is variant.add without fit, so an agent's variant is
// always one fan-out cell with background fit scale (A-143), and it lands on the campaign's
// undo list. delete_variant is variant.delete, policy ask: the bus asks the user and the call
// waits. It has no undo (D-099) and clears the campaign's undo list (A-141). Each reply is the
// variant ID only.
import { variantAddInput, variantDeleteInput } from '@/shared/schemas/commands/variant'
import type { ReplyPicker } from './read-replies'
import type { ToolDef } from './table'

const variantIdOnly: ReplyPicker = (data) => ({
  variantId: (data as { variantId: string }).variantId,
})

export const VARIANT_EDIT_TOOLS: readonly ToolDef[] = [
  {
    name: 'add_variant',
    description:
      'Add one variant to a direction of an open project, at a size and a language from the ' +
      "campaign's lists, made from the direction's master with its background scaled to fit. " +
      'Text layers in a language other than the master\'s start as "missing" until text is ' +
      'set. No translation is started. The user can undo it. Gives the new variant ID.',
    kind: 'command',
    target: 'variant.add',
    input: variantAddInput.omit({ fit: true }),
    reply: variantIdOnly,
  },
  {
    name: 'delete_variant',
    description:
      'Delete one variant of an open project, with its layers. A master cannot be deleted. ' +
      'This cannot be undone. It also empties the undo list of its whole campaign, so the ' +
      "campaign's earlier changes can no longer be undone either. The user is asked in the " +
      'app every time, and this call waits up to two minutes for the answer. A refusal is ' +
      'final: do not ask again for the same variant unless the user tells you to.',
    kind: 'command',
    target: 'variant.delete',
    input: variantDeleteInput,
    reply: variantIdOnly,
  },
]
