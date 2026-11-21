import { z } from 'zod'

// SPEC 3.3 layer JSON columns. Frozen contract (SPEC 14, Phase 2 step 0).
export const HEX_COLOUR = /^#[0-9A-Fa-f]{6}$/

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
  color: z.string().regex(HEX_COLOUR),
  align: z.enum(['left', 'center', 'right']),
  lineHeight: z.number(), // multiple of font size
  letterSpacing: z.number().min(-0.2).max(1), // em; 0 = the font's own spacing [FR-249]
})
export type TextStyle = z.infer<typeof TextStyle>

export const ImageStyle = z.object({ opacity: z.number().min(0).max(1) })
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
