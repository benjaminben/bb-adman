// The cutout job's shapes (spec/ai-jobs.md "Contracts", "Cut-out"). Shared, so the window can
// read them; this file imports nothing from the main process.
import { z } from 'zod'

// The layer's picture at the moment the run was started.
export const cutoutJobRequest = z.object({ sourceAssetId: z.string().min(1) })

// One ID, kept as a list so the earlier options read picture and cut-out runs alike.
export const cutoutJobResult = z.object({ assetIds: z.array(z.string()) })

export type CutoutJobRequest = z.infer<typeof cutoutJobRequest>
export type CutoutJobResult = z.infer<typeof cutoutJobResult>
