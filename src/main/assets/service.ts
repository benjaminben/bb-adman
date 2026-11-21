// The AssetService of SPEC 14 "Contract between the slices" (types.ts). Paths come only from
// the path resolver; rows are read only through db/rows.ts (SPEC 4.4).
import fs from 'node:fs'
import type { AssetService } from './types'
import type { ProjectHandle } from '../db/project-file'
import { readMeta } from '../db/meta'
import { readWireRow, readWireRows } from '../db/rows'
import { assetsDirFor, managedPath, resolveAssetFile } from './path-resolver'
import { assetNotFound, missingFile } from './errors'
import type { AssetRow } from '../../shared/schemas/rows/asset'

// SPEC 3.2: asset IDs are ULIDs. Extensions as in the asset.addGenerated schema. Both are
// checked so a managed file can never be written outside the assets folder.
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/
const EXT = /^[a-z0-9]{1,10}$/

function assetRow(project: ProjectHandle, assetId: string): AssetRow {
  const row = readWireRow(project.db, 'asset', { id: assetId }) as AssetRow | null
  if (!row) throw assetNotFound()
  return row
}

export function assetsDirOf(project: ProjectHandle): string {
  return assetsDirFor(project.filePath, readMeta(project.db))
}

export function resolveRow(project: ProjectHandle, row: AssetRow): Promise<string | 'missing'> {
  return resolveAssetFile(project.filePath, row)
}

export function createAssetService(): AssetService {
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
      if (!ULID.test(file.assetId) || !EXT.test(file.ext)) {
        throw new Error('writeManaged was given an asset ID or extension it cannot use')
      }
      const dir = assetsDirOf(project)
      await fs.promises.mkdir(dir, { recursive: true })
      await fs.promises.writeFile(managedPath(dir, file.assetId, file.ext), file.bytes, {
        flag: 'wx',
      })
    },
    async read(project, assetId) {
      const row = assetRow(project, assetId)
      const file = await resolveRow(project, row)
      if (file === 'missing') throw missingFile([assetId])
      return { bytes: new Uint8Array(await fs.promises.readFile(file)), mime: row.mime }
    },
  }
}
