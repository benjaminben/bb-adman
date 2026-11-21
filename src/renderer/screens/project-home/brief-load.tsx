// "Load a brief" (SPEC 14 1.41 TP-1).
import type { SubjectRow } from '../../../shared/schemas/rows/subject'

export function BriefLoad(_props: { projectId: string; subjects: SubjectRow[] }) {
  return <button type="button">Load a brief</button>
}
