import { z } from 'zod'
import { projectScoped } from './project-scoped'

// SPEC 4.2 subject.create, subject.update, subject.delete; SPEC 3.2 subject ID format.

// 1 to 64 characters from A-Z a-z 0-9 - _ (SPEC 3.2).
export const SubjectId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)

const name = z.string().trim().min(1)

export const subjectCreateInput = projectScoped.extend({
  id: SubjectId,
  name,
  description: z.string().default(''),
})
export type SubjectCreateInput = z.infer<typeof subjectCreateInput>

// The subject.create reply (SPEC 14 1.42 C4-2).
export type SubjectCreated = { subjectId: string }

export const subjectUpdateInput = projectScoped.extend({
  subjectId: z.string().min(1),
  name: name.optional(),
  description: z.string().optional(),
})
export type SubjectUpdateInput = z.infer<typeof subjectUpdateInput>

export const subjectDeleteInput = projectScoped.extend({ subjectId: z.string().min(1) })
export type SubjectDeleteInput = z.infer<typeof subjectDeleteInput>
