// The copy_options job's shapes (spec/ai-jobs.md "Contracts", "Copy options"). Shared, so the
// window can read them; this file imports nothing from the main process.
import { z } from 'zod'
import { MAX_COPY_OPTIONS } from '@/shared/config/copy-options'

export const copyJobRequest = z.object({
  role: z.enum(['call_to_action', 'text']),
  language: z.string().min(1),
  count: z.number().int().min(1).max(MAX_COPY_OPTIONS),
  maxChars: z.number().int().positive(),
})

export const copyJobResult = z.object({ options: z.array(z.string().min(1)) })

export type CopyJobRequest = z.infer<typeof copyJobRequest>
export type CopyJobResult = z.infer<typeof copyJobResult>
