// The image_generation job's shapes (SPEC 14 [1.42] H-R1, H4-1): what generation.runImages
// stores in job.request, and what the job keeps and returns in job.result. Shared, so the
// window can read them; this file imports nothing from the main process.
import { z } from 'zod'
import { MAX_IMAGES_PER_RUN } from '@/shared/config/defaults'
import { referenceIds } from '@/shared/schemas/reference-ids'
import { workflowIdSchema } from '@/shared/comfy/custom-workflow'

export const imageJobRequest = z.object({
  prompt: z.string().min(1),
  referenceAssetIds: referenceIds,
  count: z.number().int().min(1).max(MAX_IMAGES_PER_RUN),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  // D-104: the ComfyUI workflow the command chose. Absent on rows made before it, and for
  // other providers.
  workflowId: workflowIdSchema.optional(),
})

// A key of `failures` is a provider error kind; its value is how many calls failed that way.
export const imageJobResult = z.object({
  assetIds: z.array(z.string()),
  failures: z.record(z.string(), z.number().int()),
})

export type ImageJobRequest = z.infer<typeof imageJobRequest>
export type ImageJobResult = z.infer<typeof imageJobResult>
