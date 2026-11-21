// The drop target (spec/screens-campaign.md, "Importing by dropping files"). Mounted by the
// project page by S2-2, also while a campaign is open; S2-10 fills it.
import type { SubjectRow } from '@/shared/schemas/rows/subject'

export type DropImportProps = { projectId: string; projectName: string; subjects: SubjectRow[] }

export function DropImport(_props: DropImportProps) {
  return null
}
