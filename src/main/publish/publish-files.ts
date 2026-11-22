// The remote paths of one publish (spec/phases/phase-09.md "Publishing"; "Published layout").
// The export answers each file's path relative to the campaign folder, with no `exports/` in
// front (Phase 8's layout is {campaignId}/{postTitle}/...): an ad goes to exports/{relPath},
// the reports and the sheet to their fixed names, so the export's report-{stamp} names never
// reach the storage. Every path is checked as a whole before anything is uploaded: each part
// by campaignPath, a `.partial` name refused, and no two equal in lower case after Unicode NFC
// (Dropbox ignores case), manifest.json among them. A clash ends the publish with
// publish_paths_clash.
import { ProviderFailure } from '@/main/providers/types'
import { refusePath } from '@/main/providers/storage-paths'
import { contentTypeFor } from '@/shared/publish/content-types'
import {
  campaignPath,
  exportPath,
  MANIFEST,
  REPORT_HTML,
  REPORT_JSON,
  TRANSLATIONS_CSV,
} from '@/shared/publish/paths'
import { foldPath } from './clean-up'
import { openFileInside } from './open-inside'
import type { ExportedFile } from './ports'
import type { UploadFile } from './upload'

const ROLE_PATHS = {
  report_html: REPORT_HTML,
  report_json: REPORT_JSON,
  translations_csv: TRANSLATIONS_CSV,
} as const

export const pathsClash = () =>
  new ProviderFailure({
    kind: 'other',
    reason: 'publish_paths_clash',
    detail: 'publish_paths_clash',
  })

export function remotePathOf(file: ExportedFile): string {
  return file.role === 'ad' ? exportPath(file.relPath) : ROLE_PATHS[file.role]
}

// Refuses the whole list before any upload.
export function checkPublishPaths(campaignId: string, paths: string[]): void {
  const seen = new Set([foldPath(MANIFEST)])
  for (const rel of paths) {
    campaignPath(campaignId, rel)
    if (rel.toLowerCase().endsWith('.partial')) refusePath()
    if (contentTypeFor(rel) === null) refusePath()
    const folded = foldPath(rel)
    if (seen.has(folded)) throw pathsClash()
    seen.add(folded)
  }
}

// An exported file is read only from inside the work folder (open-inside.ts).
export function exportUpload(work: string, file: ExportedFile): UploadFile {
  const rel = remotePathOf(file)
  return {
    path: rel,
    contentType: contentTypeFor(rel) ?? refusePath(),
    open: () => openFileInside(work, file.absPath),
  }
}
