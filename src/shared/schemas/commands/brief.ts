import { z } from 'zod'
import { projectScoped } from './project-scoped'

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
