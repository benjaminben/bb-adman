// The brief_extraction job's shapes (spec/ai-jobs.md "Contracts", "Brief reading"). Shared, so
// the window can read them; this file imports nothing from the main process.
import { z } from 'zod'
import { BriefDraft } from '@/shared/schemas/brief'

// The brief's whole text, so a retry needs no file.
export const briefJobRequest = z.object({ text: z.string().min(1) })

export const briefJobResult = z.object({
  draft: BriefDraft,
  primaryLanguage: z.string().nullable(),
})

export type BriefJobRequest = z.infer<typeof briefJobRequest>
export type BriefJobResult = z.infer<typeof briefJobResult>
