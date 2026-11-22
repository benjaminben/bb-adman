// R2C-6 (spec/phases/round-2-campaign.md, design addition 5, "The subject dialog"). Pure.
// A new subject's ID is made from its name as a brief's is (briefSubjectIds), stepping around
// every subject ID the project already has.
import { briefSubjectIds } from '@/renderer/screens/project-home/campaign-input'

export type SubjectField = 'name' | 'photos'
export type SubjectProblem = { field: SubjectField; message: string }

export function newSubjectId(name: string, subjects: Array<{ id: string }>): string {
  const ids = briefSubjectIds([...subjects.map((s) => ({ id: s.id })), { name: name.trim() }])
  return ids[ids.length - 1]?.id ?? 'subject'
}

// photos is null when editing: an edit has no photo part.
export function subjectProblems(values: {
  name: string
  photos: string[] | null
}): SubjectProblem[] {
  const problems: SubjectProblem[] = []
  if (values.name.trim() === '') problems.push({ field: 'name', message: 'Enter a name.' })
  if (values.photos !== null && values.photos.length === 0)
    problems.push({ field: 'photos', message: 'Add at least one photo.' })
  return problems
}
