// The file side of asset.import (SPEC 3.6 prepare step; FR-050 to FR-054, R-08). Inspects
// every file first, then copies the new ones into the assets folder when asked. A file whose
// content is already in the project is reused, not copied again (FR-053).
import fs from 'node:fs'
import { ulid } from 'ulid'
import type { ProjectHandle } from '@/main/db/project-file'
import { readWireRows } from '@/main/db/rows'
import { inspectFile, inspectFolderFile, type InspectedFile } from './inspect'
import { expandPaths } from './folder-walk'
import { ensureAssetsDir } from './service'
import { managedPath, relativeToProject } from './path-resolver'
import type { AssetRow } from '@/shared/schemas/rows/asset'

export type NewAsset = InspectedFile & {
  id: string
  storage: 'linked' | 'managed'
  absPath: string
  relPath: string
}

export type PreparedImport = {
  // The content hash of each given path, in the order given.
  hashes: string[]
  // The content hashes of the given files that are animated WebP files (S2-17).
  animatedHashes: string[]
  // One entry per content hash the project did not hold when prepare ran.
  newAssets: NewAsset[]
  // Files this step copied, for undoPrepare.
  copies: string[]
  // Folder entries skipped (SPEC 14, Slice A rulings point 5).
  skippedCount: number
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
  const target = managedPath(await ensureAssetsDir(project), id, file.ext)
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
  const expanded = await expandPaths(paths)
  let skippedCount = expanded.skippedCount
  const files: InspectedFile[] = []
  for (const p of expanded.paths) {
    const file = p.inFolder ? await inspectFolderFile(p.file) : await inspectFile(p.file)
    if (file) files.push(file)
    else skippedCount += 1
  }
  const known = assetIdsByHash(project)
  const fresh = new Map<string, InspectedFile>()
  for (const f of files) if (!known.has(f.contentHash)) fresh.set(f.contentHash, f)
  const copies: string[] = []
  try {
    const newAssets: NewAsset[] = []
    for (const f of fresh.values()) newAssets.push(await place(project, f, copy, copies))
    const hashes = files.map((f) => f.contentHash)
    const animatedHashes = files.filter((f) => f.animated).map((f) => f.contentHash)
    return { hashes, animatedHashes, newAssets, copies, skippedCount }
  } catch (e) {
    await removeCopies(copies)
    throw e
  }
}
