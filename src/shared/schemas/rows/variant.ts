import { z } from 'zod'

// SPEC 3.3 variant and variant_subject, in wire form (SPEC 4.4).
export const VariantRow = z.object({
  id: z.string(),
  directionId: z.string(),
  title: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  sizeLabel: z.string(),
  language: z.string(),
  format: z.enum(['image', 'video']),
  durationMs: z.number().int(),
  durationOverridden: z.boolean(),
  rev: z.number().int(),
  createdBy: z.enum(['user', 'agent']),
  createdAt: z.string(),
  agentChangedAt: z.string().nullable(), // [1.8] FR-239; null = never
  firstClipMade: z.boolean(), // P7-2, OI-20: the first clip has been made
  sound: z.enum(['clips', 'file', 'none']),
  soundAssetId: z.string().nullable(), // the sound file when sound is 'file'
})
export type VariantRow = z.infer<typeof VariantRow>

export const VariantSubjectRow = z.object({ variantId: z.string(), subjectId: z.string() })
export type VariantSubjectRow = z.infer<typeof VariantSubjectRow>
