import { z } from 'zod'
import { projectScoped } from './project-scoped'
import type { BriefDraft } from '../brief'

// SPEC 4.2 brief.parse: a file path or pasted text, exactly one of the two (SPEC 6.1).
export const briefParseInput = projectScoped
  .extend({
    filePath: z.string().min(1).optional(),
    text: z.string().optional(),
  })
  .refine((i) => (i.filePath === undefined) !== (i.text === undefined), {
    message: 'Give a file path or text, not both.',
    path: ['filePath'],
  })
export type BriefParseInput = z.infer<typeof briefParseInput>

// The brief.parse reply (SPEC 14 1.42 C4-2), here so the window can import it.
export type BriefParsed = { draft: BriefDraft; primaryLanguage: string | null }
