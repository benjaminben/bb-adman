// The generative_fill job's shapes (spec/links-and-sync.md "Generative fill"): what
// generation.runFill stores in job.request, and what the job returns in job.result. Shared, so
// the window can read them; this file imports nothing from the main process.
import { z } from 'zod'

const side = z.number().positive()

export const generativeFillJobRequest = z.object({
  prompt: z.string().min(1),
  sourceAssetId: z.string().min(1),
  // The background's box on the canvas when the run started.
  placement: z.object({ x: z.number(), y: z.number(), width: side, height: side }),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
})

// One ID, kept as a list so the earlier options read fills with the other picture runs.
export const generativeFillJobResult = z.object({ assetIds: z.array(z.string()) })

export type GenerativeFillJobRequest = z.infer<typeof generativeFillJobRequest>
export type GenerativeFillJobResult = z.infer<typeof generativeFillJobResult>
