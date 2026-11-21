import { z } from 'zod'
import { Geometry } from '@/shared/schemas/layer'

// spec/data-model-campaign.md background_clip, in wire form (SPEC 4.4). P5-1 adds it for
// VariantSnapshot; the clip commands and its place in ROW_SCHEMAS come with Phase 7.
export const BackgroundClipRow = z.object({
  id: z.string(),
  variantId: z.string(),
  assetId: z.string(),
  startMs: z.number().int(),
  inMs: z.number().int(),
  outMs: z.number().int(),
  placement: Geometry.nullable(), // null = the background layer's geometry
})
export type BackgroundClipRow = z.infer<typeof BackgroundClipRow>
