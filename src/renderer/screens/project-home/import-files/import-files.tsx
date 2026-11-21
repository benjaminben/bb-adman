// "Import files…" and "Import a folder…" (spec/screens-campaign.md, "Import buttons"). Mounted
// in the "Files" section by S2-2; S2-9 fills it.
import type { SubjectRow } from '@/shared/schemas/rows/subject'

export type ImportFilesProps = { projectId: string; subjects: SubjectRow[] }

export function ImportFiles(_props: ImportFilesProps) {
  return null
}
