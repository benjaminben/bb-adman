// The translation job's shapes (spec/phases/phase-06.md, design addition 2). Shared, so the
// window can read them; this file imports nothing from the main process.
import { z } from 'zod'

const id = z.string().min(1)

// One job per direction and language (A-154). targets is empty in 'sync' mode (P6-16).
export const translationJobRequest = z.object({
  mode: z.enum(['write', 'sync']),
  directionId: id,
  from: id,
  to: id,
  region: z.string(),
  audience: z.string(),
  items: z.array(z.object({ key: id, text: z.string(), masterCopyRev: z.number().int().min(0) })),
  targets: z.array(z.object({ layerId: id, key: id, copyRev: z.number().int().min(0) })),
})

export const translationJobResult = z.object({
  items: z.array(z.object({ key: id, text: z.string() })),
  written: z.number().int().min(0),
})

export type TranslationJobRequest = z.infer<typeof translationJobRequest>
export type TranslationJobResult = z.infer<typeof translationJobResult>
