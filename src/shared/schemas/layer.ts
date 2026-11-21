import { z } from 'zod'

// SPEC 3.3 layer JSON columns. Frozen contract (SPEC 14, Phase 2 step 0).
export const HEX_COLOUR = /^#[0-9A-Fa-f]{6}$/

// The bounds of the look fields (LK-1). The Scene clamps to these again before drawing.
export const LOOK_LIMITS = {
  boxOutlineWidth: { min: 0, max: 100 },
  boxRadius: { min: 0, max: 2000 },
  boxPadding: { min: 0, max: 2000 },
  shadeStrength: { min: 0, max: 1 },
  shadeReach: { min: 0.05, max: 1 },
} as const

export const VERTICAL_ALIGNS = ['top', 'middle', 'bottom'] as const
export const SHADE_SIDES = ['bottom', 'top', 'left', 'right', 'all'] as const

const colour = z.string().regex(HEX_COLOUR)
const bounded = (limit: { min: number; max: number }) => z.number().min(limit.min).max(limit.max)

const box = { x: z.number(), y: z.number(), width: z.number(), height: z.number() }

// Pixels, top-left origin; rotation in degrees; crop in source pixels.
export const Geometry = z.object({
  ...box,
  rotation: z.number(),
  crop: z.object(box).nullable(),
})
export type Geometry = z.infer<typeof Geometry>

export const TextStyle = z.object({
  fontAssetId: z.string().nullable(), // null = bundled default font
  fontSize: z.number().positive(),
  fontWeight: z.number(),
  color: colour,
  align: z.enum(['left', 'center', 'right']),
  lineHeight: z.number(), // multiple of font size
  letterSpacing: z.number().min(-0.2).max(1), // em; 0 = the font's own spacing [FR-249]
  // Look fields (LK-1, spec/data-model-campaign.md "Look fields"). Optional, absent = the
  // default of textLookOf. No .default(): Zod 4 would fill it inside a patch's partial().
  verticalAlign: z.enum(VERTICAL_ALIGNS).optional(),
  allCaps: z.boolean().optional(),
  boxColor: colour.nullable().optional(), // fill behind the text; null = none
  boxOutlineColor: colour.nullable().optional(), // null = no outline
  boxOutlineWidth: bounded(LOOK_LIMITS.boxOutlineWidth).optional(), // px; 0 = no outline
  boxRadius: bounded(LOOK_LIMITS.boxRadius).optional(), // px
  boxPadding: bounded(LOOK_LIMITS.boxPadding).optional(), // px on all four sides
})
export type TextStyle = z.infer<typeof TextStyle>

// A shade over a picture; replaced whole by a patch, never merged (A-75).
export const Shade = z.strictObject({
  color: colour,
  from: z.enum(SHADE_SIDES),
  strength: bounded(LOOK_LIMITS.shadeStrength), // how opaque where strongest
  reach: bounded(LOOK_LIMITS.shadeReach), // share of the box it fades across; unused for 'all'
})
export type Shade = z.infer<typeof Shade>

export const ImageStyle = z.object({
  opacity: z.number().min(0).max(1),
  // Look fields (LK-1); absent = the default of pictureLookOf.
  fillColor: colour.nullable().optional(), // background layers only (A-73); null = none
  shade: Shade.nullable().optional(),
})
export type ImageStyle = z.infer<typeof ImageStyle>

// endMs null = end of the variant.
export const Timing = z.object({ startMs: z.number(), endMs: z.number().nullable() })
export type Timing = z.infer<typeof Timing>

export const ANIMATION_PRESETS = ['none', 'fade', 'fade-up', 'slide', 'stagger-words'] as const

export const AnimationBlock = z.object({
  preset: z.enum(ANIMATION_PRESETS),
  startMs: z.number(), // relative to the variant start
  durationMs: z.number(),
})
export type AnimationBlock = z.infer<typeof AnimationBlock>

export const Animation = z.object({ entrance: AnimationBlock, exit: AnimationBlock })
export type Animation = z.infer<typeof Animation>

const counter = z.number().int().min(0)

// The revs and synced_revs counters (SPEC 3.3, 3.4).
export const Revs = z.object({
  copy: counter,
  style: counter,
  geometry: counter,
  source: counter,
  timing: counter,
  animation: counter,
})
export type Revs = z.infer<typeof Revs>
