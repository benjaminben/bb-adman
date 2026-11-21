// The AssetService of SPEC 14 "Contract between the slices" (types.ts). Paths come only from
// the path resolver; rows are read only through db/rows.ts (SPEC 4.4).
import fs from 'node:fs'
import path from 'node:path'
import type { AssetService } from './types'
import type { ProjectHandle } from '../db/project-file'
import { readMeta } from '../db/meta'
import { readWireRow, readWireRows } from '../db/rows'
import { assetsDirFor, managedPath, pathInside, resolveAssetFile } from './path-resolver'
import { assetNotFound, assetsFolderMissing, missingFile } from './errors'
import { notAPicture, readPicture } from './read-picture'
import { MAX_PICTURE_BYTES } from '../providers/picture-limits'
import type { AssetRow } from '../../shared/schemas/rows/asset'

function assetRow(project: ProjectHandle, assetId: string): AssetRow {
  const row = readWireRow(project.db, 'asset', { id: assetId }) as AssetRow | null
  if (!row) throw assetNotFound()
  return row
}

export function assetsDirOf(project: ProjectHandle): string {
  return assetsDirFor(project.filePath, readMeta(project.db))
}

// SPEC 14 [1.32] U9: the one place the assets folder is made. A folder that exists is used,
// wherever it is; a missing one is made only inside the project file's folder, because the
// stored places come from the project file and are untrusted (SPEC 8.1).
export async function ensureAssetsDir(project: ProjectHandle): Promise<string> {
  const dir = assetsDirOf(project)
  const stat = await fs.promises.stat(dir).catch(() => null)
  if (stat?.isDirectory()) return dir
  if (pathInside(path.dirname(project.filePath), dir) === null) throw assetsFolderMissing()
  await fs.promises.mkdir(dir, { recursive: true })
  return dir
}

export function resolveRow(project: ProjectHandle, row: AssetRow): Promise<string | 'missing'> {
  return resolveAssetFile(project.filePath, row)
}

// Only a test hands in another picture limit; core.ts calls this with no argument (SPEC 14
// [1.27] R2).
export function createAssetService(options: { maxPictureBytes?: number } = {}): AssetService {
  const maxPictureBytes = options.maxPictureBytes ?? MAX_PICTURE_BYTES
  return {
    async missingAssetIds(project) {
      const rows = readWireRows(project.db, 'asset') as AssetRow[]
      const found = await Promise.all(rows.map((r) => resolveRow(project, r)))
      return rows.filter((_, i) => found[i] === 'missing').map((r) => r.id)
    },
    async resolve(project, assetId) {
      return resolveRow(project, assetRow(project, assetId))
    },
    assetsDir: assetsDirOf,
    async writeManaged(project, file) {
      // managedPath checks the ID and extension before any folder is made.
      const target = managedPath(assetsDirOf(project), file.assetId, file.ext)
      await ensureAssetsDir(project)
      await fs.promises.writeFile(target, file.bytes, {
        flag: 'wx',
      })
    },
    async read(project, assetId) {
      const row = assetRow(project, assetId)
      if (row.kind !== 'image') throw notAPicture(row.displayName)
      const file = await resolveRow(project, row)
      if (file === 'missing') throw missingFile([assetId])
      return readPicture(file, row.displayName, maxPictureBytes)
    },
  }
}
