// spec/editor-commands.md: the inputs and replies of the layer commands. Every input is strict,
// so an unknown key is INVALID_INPUT. The checks that need the stored layer (its type, the
// merged style, the assets it names) are the handlers' (spec/editor-commands.md, "Rules").
import { z } from 'zod'
import { AnimationBlock, Geometry, ImageStyle, TextStyle, Timing } from '@/shared/schemas/layer'
import { LayerRow } from '@/shared/schemas/rows/layer'
import { projectScoped } from './project-scoped'

// z.number() refuses Infinity and NaN, so every number here is finite.
const size = z.number().min(1)
const crop = z.object({ x: z.number(), y: z.number(), width: size, height: size }).strict()

const fields = {
  name: z.string().trim().min(1).max(100),
  visible: z.boolean(),
  locked: z.boolean(),
  copy: z.string().max(5000),
  // Fields are merged into the stored style; a mix of text and picture fields is refused.
  style: z.union([TextStyle.partial().strict(), ImageStyle.partial().strict()]),
  // Fields are merged; crop is replaced whole (a box or null).
  geometry: Geometry.extend({ width: size, height: size, crop: crop.nullable() })
    .partial()
    .strict(),
  source: z
    .object({ assetId: z.string().min(1) })
    .strict()
    .nullable(),
  timing: Timing.strict(),
  // Each block is replaced whole.
  animation: z
    .object({ entrance: AnimationBlock.strict(), exit: AnimationBlock.strict() })
    .partial()
    .strict(),
}

export const layerPatch = z
  .object(fields)
  .partial()
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, { message: 'Change at least one value.' })
export type LayerPatch = z.infer<typeof layerPatch>

export const layerUpdateInput = projectScoped
  .extend({ layerId: z.string().min(1), patch: layerPatch })
  .strict()
export type LayerUpdateInput = z.infer<typeof layerUpdateInput>

const { name, copy, style, geometry, source, visible, locked } = fields
export const layerValues = z
  .object({ name, copy, style, geometry, source, visible, locked })
  .partial()
  .strict()
export type LayerValues = z.infer<typeof layerValues>

export const layerCreateInput = projectScoped
  .extend({
    variantId: z.string().min(1),
    type: z.enum(['image', 'text']),
    values: layerValues.optional(),
  })
  .strict()
export type LayerCreateInput = z.infer<typeof layerCreateInput>

export const layerDeleteInput = projectScoped.extend({ layerId: z.string().min(1) }).strict()
export type LayerDeleteInput = z.infer<typeof layerDeleteInput>

// System command: only the inverse of layer.delete. order is every non-background layer ID of
// the variant after the restore, lowest first.
export const layerRestoreInput = projectScoped
  .extend({ layer: LayerRow.strict(), order: z.array(z.string().min(1)) })
  .strict()
export type LayerRestoreInput = z.infer<typeof layerRestoreInput>

// Every non-background layer ID of the variant, each once, lowest first (checked by the handler).
export const layerReorderInput = projectScoped
  .extend({ variantId: z.string().min(1), layerIds: z.array(z.string().min(1)) })
  .strict()
export type LayerReorderInput = z.infer<typeof layerReorderInput>

export const layerReportOverflowInput = projectScoped
  .extend({
    layerId: z.string().min(1),
    overflow: z.boolean(),
    variantRev: z.number().int().min(0),
  })
  .strict()
export type LayerReportOverflowInput = z.infer<typeof layerReportOverflowInput>

// Replies.
export type LayerReply = { layerId: string }
export type LayerReorderReply = { variantId: string }
export type LayerOverflowReply = { applied: boolean }
