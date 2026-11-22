// render_variant (spec/phases/phase-10.md, A-233, A-234; P10-3). The variant drawn now, the
// complete ad with every layer, linked pictures outside the project's folder included
// (stakeholder ruling). content 'png': the reply is one image item of the drawn bytes and
// nothing else, so no path, file name, hash or address of a source reaches the agent.
import { variantRenderInput, type VariantRender } from '@/shared/schemas/queries/render'
import type { ReplyPicker } from './read-replies'
import type { ToolDef } from './table'

// The allow-list of the reply: the drawn PNG bytes, and not the size or rev.
export const pngOnly: ReplyPicker = (data) => ({ png: (data as VariantRender).png })

export const RENDER_TOOLS: readonly ToolDef[] = [
  {
    name: 'render_variant',
    description:
      'Draw one variant of an open project as it looks now, with every layer, and get it ' +
      'back as one PNG picture. max_dimension sets the longer side (64 to 2048, default ' +
      '1024, never larger than the variant); time_ms is the moment of a video variant to ' +
      'draw (default 0). Changes nothing in the project.',
    kind: 'query',
    target: 'variant.render',
    input: variantRenderInput,
    reply: pngOnly,
    content: 'png',
  },
]
