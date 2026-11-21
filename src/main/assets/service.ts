// The AssetService of SPEC 14 "Contract between the slices" (types.ts). Paths come only from
// the path resolver; rows are read only through db/rows.ts (SPEC 4.4).
import fs from 'node:fs'
import path from 'node:path'
import type { AssetService } from './types'
import type { ProjectHandle } from '../db/project-file'
import { readMeta } from '../db/meta'
import { readWireRow, readWireRows } from '../db/rows'
import {
  assetsDirFor,
  managedPath,
  pathAtOrInside,
  pathInside,
  resolveAssetFile,
} from './path-resolver'
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

const isMissing = (e: unknown) => {
  const code = (e as NodeJS.ErrnoException).code
  return code === 'ENOENT' || code === 'ENOTDIR'
}

// SPEC 14 [1.34] V1: the real path of the nearest parent of `dir` that exists. A path that
// is not there (ENOENT, ENOTDIR) moves one step up; any other error refuses. [1.37] X1: a
// path whose realpath fails but whose lstat succeeds is a link that does not resolve.
async function nearestRealParent(dir: string): Promise<string> {
  let p = path.dirname(dir)
  for (;;) {
    try {
      return await fs.promises.realpath(p)
    } catch (e) {
      if (!isMissing(e) || path.dirname(p) === p) throw assetsFolderMissing()
      const linkFound = await fs.promises.lstat(p).then(
        () => true,
        (le: unknown) => {
          if (!isMissing(le)) throw assetsFolderMissing()
          return false
        },
      )
      if (linkFound) throw assetsFolderMissing()
      p = path.dirname(p)
    }
  }
}

// SPEC 14 [1.32] U9: the one place the assets folder is made. A folder that exists is used,
// wherever it is; a missing one is made only inside the project file's folder, because the
// stored places come from the project file and are untrusted (SPEC 8.1). [1.34] V1: judged
// on real paths too, so a link cannot lead out; a failed mkdir gives the same refusal.
export async function ensureAssetsDir(project: ProjectHandle): Promise<string> {
  const dir = assetsDirOf(project)
  const stat = await fs.promises.stat(dir).catch(() => null)
  if (stat?.isDirectory()) return dir
  const projectDir = path.dirname(project.filePath)
  if (pathInside(projectDir, dir) === null) throw assetsFolderMissing()
  // [1.37] X1: something that is not a folder is in the way (a file, a link to nowhere).
  const inTheWay = await fs.promises.lstat(dir).then(
    () => true,
    () => false,
  )
  if (inTheWay) throw assetsFolderMissing()
  const [realProjectDir, realParent] = await Promise.all([
    fs.promises.realpath(projectDir).catch(() => {
      throw assetsFolderMissing()
    }),
    nearestRealParent(dir),
  ])
  if (!pathAtOrInside(realProjectDir, realParent)) throw assetsFolderMissing()
  await fs.promises.mkdir(dir, { recursive: true }).catch(() => {
    throw assetsFolderMissing()
  })
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
