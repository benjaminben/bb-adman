// spec/links-and-sync.md: the shapes Phase 5's commands share. A snapshot is a whole variant
// as the database holds it; a sync decision is the user's choice for one change.
import { z } from 'zod'
import { BackgroundClipRow } from '@/shared/schemas/rows/background-clip'
import { LayerRow } from '@/shared/schemas/rows/layer'
import { VariantRow } from '@/shared/schemas/rows/variant'

// The most variants one system command names ("Adding back and removing variants").
export const MAX_SYSTEM_VARIANTS = 500
// The most choices one sync.apply carries ("Sync").
export const MAX_SYNC_DECISIONS = 2000

// The values sync and fan-out write, by group.
export const LayerValues = LayerRow.pick({
  copy: true,
  style: true,
  geometry: true,
  source: true,
  timing: true,
  animation: true,
})
export type LayerValues = z.infer<typeof LayerValues>

export const VariantSnapshot = z
  .object({
    variant: VariantRow.strict(),
    subjectIds: z.array(z.string().min(1)),
    layers: z.array(LayerRow.strict()),
    clips: z.array(BackgroundClipRow.strict()),
  })
  .strict()
export type VariantSnapshot = z.infer<typeof VariantSnapshot>

export const SyncDecision = z
  .object({
    variantId: z.string().min(1),
    layerKey: z.string().min(1),
    accept: z.boolean(),
    overrides: z.array(
      z.object({ path: z.string().min(1), choice: z.enum(['keep-mine', 'take-master']) }).strict(),
    ),
  })
  .strict()
export type SyncDecision = z.infer<typeof SyncDecision>

// How the background fits a new size in fan-out; variant.add has no fill (A-143).
export const FanOutFit = z.enum(['scale', 'crop', 'fill'])
export type FanOutFit = z.infer<typeof FanOutFit>
export const AddFit = z.enum(['scale', 'crop'])
export type AddFit = z.infer<typeof AddFit>

// 1 to 100 characters after trimming (A-139).
export const directionName = z.string().trim().min(1).max(100)
