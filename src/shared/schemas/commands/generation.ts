import { z } from 'zod'
import { projectScoped } from './project-scoped'
import { MAX_IMAGES_PER_RUN } from '../../config/defaults'

// SPEC 4.2 generation.runImages [1.8]. Built in Phase 2 slice H. A slot or a layer, not both.
export const generationRunImagesInput = projectScoped
  .extend({
    variantId: z.string().min(1),
    slot: z.string().min(1).optional(),
    layerId: z.string().min(1).optional(),
    prompt: z.string().trim().min(1, 'Enter a prompt.'),
    referenceAssetIds: z.array(z.string().min(1)),
    count: z.number().int().min(1).max(MAX_IMAGES_PER_RUN),
    provider: z.string().min(1),
  })
  .refine((i) => (i.slot === undefined) !== (i.layerId === undefined), {
    message: 'Name a slot or a layer.',
    path: ['slot'],
  })
export type GenerationRunImagesInput = z.infer<typeof generationRunImagesInput>

// SPEC 4.2 generation.startVideo, with the 1.24 start and references [REQ: FR-286]. Built in
// CU-6a, which accepts only start 'none' with useReferences false and no references.
export const generationStartVideoInput = projectScoped.extend({
  variantId: z.string().min(1),
  prompt: z.string().trim().min(1, 'Enter a prompt.'),
  durationMs: z.number().int().positive(),
  provider: z.string().min(1),
  start: z.enum(['none', 'first_frame']),
  useReferences: z.boolean(),
  referenceAssetIds: z.array(z.string().min(1)),
})
export type GenerationStartVideoInput = z.infer<typeof generationStartVideoInput>
