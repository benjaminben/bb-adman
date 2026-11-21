// subject.list (spec/phases/phase-10.md, "Design additions", A-235). Both actors: the subjects
// of an open project by ID, each with the IDs of the asset rows attached to it, by ID.
import type { z } from 'zod'
import { projectScoped } from '@/shared/schemas/commands/project-scoped'

export const subjectListInput = projectScoped
export type SubjectListInput = z.infer<typeof subjectListInput>

export type SubjectList = Array<{
  id: string
  name: string
  description: string
  assetIds: string[]
}>
