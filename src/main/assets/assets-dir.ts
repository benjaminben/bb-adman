// The file side of project.setAssetsDir (SPEC 14, Slice A rulings point 4; FR-007, R-07).
// It moves no file and makes no folder. A managed file the user already moved into the new
// folder, still named {assetId}.{ext}, is found there; the others keep their own paths.
import fs from 'node:fs'
import path from 'node:path'
import type { ProjectHandle } from '@/main/db/project-file'
import { readWireRows } from '@/main/db/rows'
import { hashFile } from './inspect'
import { managedPathIn, relativeToProject } from './path-resolver'
import { AppError } from '@/shared/schemas/result'
import type { AssetRow } from '@/shared/schemas/rows/asset'

export type Repoint = {
  id: string
  absPath: string
  relPath: string
  byteSize: number
  mtimeMs: number
  contentHash: string
}

export type PreparedAssetsDir = { dir: string; dirRel: string; repoints: Repoint[] }

const MESSAGE = 'Choose a folder that exists.'

async function requireFolder(given: string): Promise<string> {
  if (!path.isAbsolute(given))
    throw new AppError('INVALID_INPUT', 'Choose a folder by its full path.')
  const dir = path.resolve(given)
  let isFolder: boolean
  try {
    isFolder = (await fs.promises.stat(dir)).isDirectory()
  } catch {
    throw new AppError('NOT_FOUND', MESSAGE)
  }
  if (!isFolder) throw new AppError('INVALID_INPUT', 'Choose a folder, not a file.')
  return dir
}

async function repoint(project: ProjectHandle, dir: string, row: AssetRow) {
  try {
    // SPEC 14 [1.32] U10: a row whose id or extension cannot form a path throws here and is
    // left alone with its own paths.
    const file = managedPathIn(dir, row)
    // SPEC 14, [1.29] T2: a regular file only; a link with that name is left alone.
    const stat = await fs.promises.lstat(file)
    if (!stat.isFile()) return null
    return {
      id: row.id,
      absPath: file,
      relPath: relativeToProject(project.filePath, file),
      byteSize: stat.size,
      mtimeMs: Math.trunc(stat.mtimeMs),
      contentHash: await hashFile(file),
    }
  } catch {
    return null
  }
}

export async function prepareAssetsDir(
  project: ProjectHandle,
  given: string,
): Promise<PreparedAssetsDir> {
  const dir = await requireFolder(given)
  const managed = (readWireRows(project.db, 'asset') as AssetRow[])
    .filter((r) => r.storage === 'managed')
    .sort((a, b) => (a.id < b.id ? -1 : 1))
  const found = await Promise.all(managed.map((r) => repoint(project, dir, r)))
  return {
    dir,
    dirRel: relativeToProject(project.filePath, dir),
    repoints: found.filter((r): r is Repoint => r !== null),
  }
}
