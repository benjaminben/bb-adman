// SPEC 3.6 "Asset files", 8.2, 12: an adman-asset://{projectId}/{assetId} address to the file
// it names. No Electron here; windows/asset-protocol.ts serves what this gives. A file is
// served only when the project is open, the asset ID is in it and its file is found.
import type { ProjectRegistry } from '../db/project-registry'
import { readWireRow } from '../db/rows'
import { resolveRow } from './service'
import type { AssetRow } from '../../shared/schemas/rows/asset'

// The raw text is matched, not a parsed URL, so nothing is folded away ("/../", "%2F"):
// both parts are ULIDs (SPEC 3.2) and nothing else may follow. ULIDs ignore letter case, and
// a browser may lower-case the host, so both parts are read in upper case.
const ADDRESS = /^adman-asset:\/\/([0-9A-HJKMNP-TV-Z]{26})\/([0-9A-HJKMNP-TV-Z]{26})$/i

export async function fileForAssetUrl(
  url: string,
  projects: ProjectRegistry,
): Promise<{ file: string; mime: string } | null> {
  const match = ADDRESS.exec(url)
  if (!match) return null
  const projectId = (match[1] ?? '').toUpperCase()
  const assetId = (match[2] ?? '').toUpperCase()
  const project = projects.get(projectId)
  if (!project) return null
  const row = readWireRow(project.db, 'asset', { id: assetId }) as AssetRow | null
  if (!row) return null
  const file = await resolveRow(project, row)
  return file === 'missing' ? null : { file, mime: row.mime }
}
