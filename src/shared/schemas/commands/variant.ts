// spec/editor-commands.md, "variant.update": the title, and from Phase 7 durationMs (P7-1),
// at least one of the two.
import { z } from 'zod'
import { LayerRow } from '@/shared/schemas/rows/layer'
import { AddFit, FanOutFit, MAX_SYSTEM_VARIANTS, VariantSnapshot } from '@/shared/schemas/links'
import { projectScoped } from './project-scoped'

// Whole milliseconds, half a second to a day.
export const MIN_DURATION_MS = 500
export const MAX_DURATION_MS = 86_400_000

export const variantUpdateInput = projectScoped
  .extend({
    variantId: z.string().min(1),
    title: z.string().trim().min(1).max(200).optional(),
    durationMs: z.number().int().min(MIN_DURATION_MS).max(MAX_DURATION_MS).optional(),
  })
  .strict()
  .refine((i) => i.title !== undefined || i.durationMs !== undefined, {
    message: 'Name a title or a duration.',
  })
export type VariantUpdateInput = z.infer<typeof variantUpdateInput>

// P7-1 (spec/data-rules.md, "Changing a variant's format"; phase-07.md "Clips and the track",
// Sound). setSound names an asset only with 'file'; 'file' without one keeps the stored asset.
export const variantSetFormatInput = projectScoped
  .extend({ variantId: z.string().min(1), format: z.enum(['image', 'video']) })
  .strict()
export type VariantSetFormatInput = z.infer<typeof variantSetFormatInput>

export const variantSetSoundInput = projectScoped
  .extend({
    variantId: z.string().min(1),
    sound: z.enum(['clips', 'file', 'none']),
    assetId: z.string().min(1).optional(),
  })
  .strict()
  .refine((i) => i.assetId === undefined || i.sound === 'file', {
    message: 'Only the file sound names an audio file.',
    path: ['assetId'],
  })
export type VariantSetSoundInput = z.infer<typeof variantSetSoundInput>

export type VariantReply = { variantId: string }

// P5-1: the Phase 5 variant commands (spec/links-and-sync.md, "Fan-out", "Adding back and
// removing variants"). Every input is strict.
const id = z.string().min(1)

// formats is images only until Phase 7 (A-133). fits names each new size's background fit;
// the handler checks that it covers exactly the sizes of another pixel size.
export const variantFanOutInput = projectScoped
  .extend({
    directionId: id,
    sizes: z.array(id).min(1),
    languages: z.array(id).min(1),
    formats: z.array(z.literal('image')).min(1),
    fits: z.record(z.string(), FanOutFit),
  })
  .strict()
export type VariantFanOutInput = z.infer<typeof variantFanOutInput>

// One variant; fit is scale when left out, never fill (A-143). Images only until Phase 7.
export const variantAddInput = projectScoped
  .extend({
    directionId: id,
    sizeLabel: id,
    language: id,
    format: z.literal('image'),
    fit: AddFit.optional(),
  })
  .strict()
export type VariantAddInput = z.infer<typeof variantAddInput>

export const variantDeleteInput = projectScoped.extend({ variantId: id }).strict()
export type VariantDeleteInput = z.infer<typeof variantDeleteInput>

// System commands: only inverses.
export const variantRemoveInput = projectScoped
  .extend({ variantIds: z.array(id).min(1).max(MAX_SYSTEM_VARIANTS) })
  .strict()
export type VariantRemoveInput = z.infer<typeof variantRemoveInput>

export const variantRestoreInput = projectScoped
  .extend({ snapshots: z.array(VariantSnapshot).min(1).max(MAX_SYSTEM_VARIANTS) })
  .strict()
export type VariantRestoreInput = z.infer<typeof variantRestoreInput>

export const variantRestoreLayersInput = projectScoped
  .extend({
    variants: z
      .array(z.object({ variantId: id, layers: z.array(LayerRow.strict()) }).strict())
      .min(1)
      .max(MAX_SYSTEM_VARIANTS),
  })
  .strict()
export type VariantRestoreLayersInput = z.infer<typeof variantRestoreLayersInput>

// Replies. fill: for each size with fit fill, its new variant in the master's language.
export type VariantFanOutReply = {
  variantIds: string[]
  fill: Array<{ sizeLabel: string; variantId: string }>
}
export type VariantsReply = { variantIds: string[] }
