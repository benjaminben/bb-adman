// set_variant_format (spec/phases/phase-10.md, the Phase 7 tool; D-025). The command's agent
// policy is allow: no dialog. Image to video makes the first clip once, from the background's
// picture; video to image keeps the clips. The input is the base schema without the undo-only
// fields (P7-10b), so an agent can never remove a clip or name one. The change is on the
// variant's undo list. The reply is the variant ID only.
import { variantSetFormatBaseInput, type VariantReply } from '@/shared/schemas/commands/variant'
import type { ReplyPicker } from './read-replies'
import type { ToolDef } from './table'

const variantIdOnly: ReplyPicker = (data) => ({ variantId: (data as VariantReply).variantId })

export const FORMAT_TOOLS: readonly ToolDef[] = [
  {
    name: 'set_variant_format',
    description:
      'Change one variant of an open project to "image" or "video". A change to video makes ' +
      "the first clip from the background's picture, once; a change back to image keeps the " +
      'clips. It is refused when the direction already has a variant at the same size and ' +
      'language in that format. Gives the variant ID. The user can undo the change.',
    kind: 'command',
    target: 'variant.setFormat',
    input: variantSetFormatBaseInput,
    reply: variantIdOnly,
  },
]
