// The clip commands (spec/phases/phase-07.md "Clips and the track", A-180 to A-183). Every
// input is strict and in whole milliseconds. The handler checks the rules that need stored
// values (overlap, a trim past the file's end, the asset's kind); the schema checks the rest.
import { z } from 'zod'
import { Geometry } from '@/shared/schemas/layer'
import { BackgroundClipRow } from '@/shared/schemas/rows/background-clip'
import { projectScoped } from './project-scoped'

// A day: the longest variant (variant.update's durationMs bound), so no time on the track
// passes it.
export const MAX_TRACK_MS = 86_400_000
// The shortest clip: outMs - inMs.
export const MIN_CLIP_MS = 100
// The most clips one call may name (reorder, restore).
export const MAX_CLIPS = 500

const id = z.string().min(1)
const ms = z.number().int().min(0).max(MAX_TRACK_MS)
const size = z.number().min(1)
const crop = z.object({ x: z.number(), y: z.number(), width: size, height: size }).strict()
// null = the background layer's geometry.
const placement = Geometry.extend({ width: size, height: size, crop: crop.nullable() })
  .strict()
  .nullable()

// startMs left out: the first free position. lengthMs left out: a still runs to the variant's
// end (3,000 ms when none is left), a video runs its whole file.
export const clipAddInput = projectScoped
  .extend({
    variantId: id,
    assetId: id,
    startMs: ms.optional(),
    lengthMs: z.number().int().min(MIN_CLIP_MS).max(MAX_TRACK_MS).optional(),
  })
  .strict()
export type ClipAddInput = z.infer<typeof clipAddInput>

export const clipUpdateInput = projectScoped
  .extend({
    clipId: id,
    startMs: ms.optional(),
    inMs: ms.optional(),
    outMs: ms.optional(),
    placement: placement.optional(),
    soundOn: z.boolean().optional(),
  })
  .strict()
  .refine(({ projectId: _p, clipId: _c, ...change }) => Object.keys(change).length > 0, {
    message: 'Name at least one thing to change.',
  })
  .refine((i) => i.inMs === undefined || i.outMs === undefined || i.outMs - i.inMs >= MIN_CLIP_MS, {
    message: 'A clip runs at least 100 ms.',
    path: ['outMs'],
  })
export type ClipUpdateInput = z.infer<typeof clipUpdateInput>

export const clipRemoveInput = projectScoped.extend({ clipId: id }).strict()
export type ClipRemoveInput = z.infer<typeof clipRemoveInput>

// A-181: every clip of the variant, laid back to back from the earliest start in this order.
export const clipReorderInput = projectScoped
  .extend({
    variantId: id,
    clipIds: z
      .array(id)
      .min(1)
      .max(MAX_CLIPS)
      .refine((ids) => new Set(ids).size === ids.length, 'Name each clip once.'),
  })
  .strict()
export type ClipReorderInput = z.infer<typeof clipReorderInput>

// System commands: no window may send them.
// clip.restore: the inverse of clip.remove and clip.reorder, the rows as they were. Each row is
// bounded as clip.add and clip.update bound what they write.
const restoreRow = BackgroundClipRow.extend({
  id,
  variantId: id,
  assetId: id,
  startMs: ms,
  inMs: ms,
  outMs: ms,
  placement,
})
  .strict()
  .refine((r) => r.outMs - r.inMs >= MIN_CLIP_MS, {
    message: 'A clip runs at least 100 ms.',
    path: ['outMs'],
  })

export const clipRestoreInput = projectScoped
  .extend({ rows: z.array(restoreRow).min(1).max(MAX_CLIPS) })
  .strict()
export type ClipRestoreInput = z.infer<typeof clipRestoreInput>

// clip.addGenerated (A-182): the video job's clip, at the first free position.
export const clipAddGeneratedInput = projectScoped.extend({ variantId: id, assetId: id }).strict()
export type ClipAddGeneratedInput = z.infer<typeof clipAddGeneratedInput>

// Replies.
export type ClipReply = { clipId: string }
export type ClipReorderReply = { variantId: string }
export type ClipRestoreReply = { clipIds: string[] }
// A variant that is gone gives { clipId: null }, never a refusal.
export type ClipAddGeneratedReply = { clipId: string | null }
