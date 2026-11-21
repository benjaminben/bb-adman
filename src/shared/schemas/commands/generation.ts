import { z } from 'zod'
import { projectScoped } from './project-scoped'

// SPEC 4.2 generation.runImages [1.8]. Built in Phase 2 slice H. A slot or a layer, not both.
export const generationRunImagesInput = projectScoped
  .extend({
    variantId: z.string().min(1),
    slot: z.string().min(1).optional(),
    layerId: z.string().min(1).optional(),
    prompt: z.string().trim().min(1, 'Enter a prompt.'),
    referenceAssetIds: z.array(z.string().min(1)),
    count: z.number().int().min(1),
    provider: z.string().min(1),
  })
  .refine((i) => (i.slot === undefined) !== (i.layerId === undefined), {
    message: 'Name a slot or a layer.',
    path: ['slot'],
  })
export type GenerationRunImagesInput = z.infer<typeof generationRunImagesInput>
