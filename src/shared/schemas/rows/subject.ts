import { z } from 'zod'

// SPEC 3.3 subject, in wire form (SPEC 4.4).
export const SubjectRow = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  createdAt: z.string(),
})
export type SubjectRow = z.infer<typeof SubjectRow>
