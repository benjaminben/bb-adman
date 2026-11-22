// Reply pickers for the layer tools (spec/phases/phase-10.md, A-233). Each gives the one ID the
// command's own reply holds and nothing else, so a field added to a reply later does not leave
// through MCP without a change here (FR-198).
import type {
  LayerReorderReply,
  LayerReply,
  LayerUpdateManyReply,
} from '@/shared/schemas/commands/layer'
import type { ReplyPicker } from './read-replies'

export const layerIdOnly: ReplyPicker = (data) => ({ layerId: (data as LayerReply).layerId })

export const layerIdsOnly: ReplyPicker = (data) => ({
  layerIds: (data as LayerUpdateManyReply).layerIds.map(String),
})

export const variantIdOnly: ReplyPicker = (data) => ({
  variantId: (data as LayerReorderReply).variantId,
})
