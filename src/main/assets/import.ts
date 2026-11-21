// The file side of asset.import (SPEC 3.6 prepare step; FR-050 to FR-054, R-08). Inspects
// every file first, then copies the new ones into the assets folder when asked. A file whose
// content is already in the project is reused, not copied again (FR-053).
import fs from 'node:fs'
import { ulid } from 'ulid'
import type { ProjectHandle } from '../db/project-file'
import { readWireRows } from '../db/rows'
import { inspectFile, type InspectedFile } from './inspect'
import { assetsDirOf } from './service'
import { managedPath, relativeToProject } from './path-resolver'
import type { AssetRow } from '../../shared/schemas/rows/asset'

export type NewAsset = InspectedFile & {
  id: string
  storage: 'linked' | 'managed'
  absPath: string
  relPath: string
}

export type PreparedImport = {
  // The content hash of each given path, in the order given.
  hashes: string[]
  // One entry per content hash the project did not hold when prepare ran.
  newAssets: NewAsset[]
  // Files this step copied, for undoPrepare.
  copies: string[]
}

export function assetIdsByHash(project: ProjectHandle): Map<string, string> {
  const rows = readWireRows(project.db, 'asset') as AssetRow[]
  return new Map(rows.map((r) => [r.contentHash, r.id]))
}

export async function removeCopies(copies: string[]): Promise<void> {
  await Promise.all(copies.map((c) => fs.promises.rm(c, { force: true })))
}

async function place(
  project: ProjectHandle,
  file: InspectedFile,
  copy: boolean,
  copies: string[],
): Promise<NewAsset> {
  const id = ulid()
  if (!copy) {
    const relPath = relativeToProject(project.filePath, file.file)
    return { ...file, id, storage: 'linked', absPath: file.file, relPath }
  }
  const dir = assetsDirOf(project)
  await fs.promises.mkdir(dir, { recursive: true })
  const target = managedPath(dir, id, file.ext)
  await fs.promises.copyFile(file.file, target, fs.constants.COPYFILE_EXCL)
  copies.push(target)
  const relPath = relativeToProject(project.filePath, target)
  return { ...file, id, storage: 'managed', absPath: target, relPath }
}

export async function prepareImport(
  project: ProjectHandle,
  paths: string[],
  copy: boolean,
): Promise<PreparedImport> {
  const files: InspectedFile[] = []
  for (const p of paths) files.push(await inspectFile(p))
  const known = assetIdsByHash(project)
  const fresh = new Map<string, InspectedFile>()
  for (const f of files) if (!known.has(f.contentHash)) fresh.set(f.contentHash, f)
  const copies: string[] = []
  try {
    const newAssets: NewAsset[] = []
    for (const f of fresh.values()) newAssets.push(await place(project, f, copy, copies))
    return { hashes: files.map((f) => f.contentHash), newAssets, copies }
  } catch (e) {
    await removeCopies(copies)
    throw e
  }
}
