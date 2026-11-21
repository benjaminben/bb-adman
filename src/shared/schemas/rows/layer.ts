import { z } from 'zod'
import { Animation, Geometry, ImageStyle, Revs, TextStyle, Timing } from '@/shared/schemas/layer'

// SPEC 3.3 layer, in wire form (SPEC 4.4).
export const LayerRow = z.object({
  id: z.string(),
  variantId: z.string(),
  key: z.string(),
  type: z.enum(['background', 'image', 'text']),
  slot: z.string().nullable(),
  name: z.string(),
  z: z.number().int(),
  visible: z.boolean(),
  locked: z.boolean(),
  linked: z.boolean(),
  overrides: z.array(z.string()),
  copy: z.string().nullable(),
  style: z.union([TextStyle, ImageStyle]),
  geometry: Geometry,
  source: z.object({ assetId: z.string() }).nullable(),
  timing: Timing,
  animation: Animation,
  revs: Revs,
  syncedRevs: Revs,
  translationStatus: z.enum(['missing', 'proposed', 'approved']).nullable(),
  translationSource: z.enum(['ai', 'agent', 'user', 'brief']).nullable(),
  overflow: z.boolean(),
})
export type LayerRow = z.infer<typeof LayerRow>
