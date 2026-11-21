// The file side of asset.relink (SPEC 14, Slice A rulings point 3; FR-009). The new file must
// be of the asset's own kind; its content may differ. With relinkSiblings, other missing
// linked assets of the old folder are followed to the same relative path under the new
// folder, and only when the file there has the row's own content hash (security class).
import fs from 'node:fs'
import type { ProjectHandle } from '@/main/db/project-file'
import { readWireRow, readWireRows } from '@/main/db/rows'
import { assetNotFound } from './errors'
import { hashFile, readFileFacts, type InspectedFile } from './inspect'
import { resolveRow } from './service'
import { pathInside, relativeToProject, siblingCandidate } from './path-resolver'
import type { AssetRelinkInput } from '@/shared/schemas/commands/asset'
import { AppError } from '@/shared/schemas/result'
import type { AssetRow } from '@/shared/schemas/rows/asset'

export type SiblingMove = {
  id: string
  contentHash: string
  absPath: string
  relPath: string
  byteSize: number
  mtimeMs: number
}

export type PreparedRelink = { file: InspectedFile; relPath: string; siblings: SiblingMove[] }

function kindMismatch(kind: string): AppError {
  return new AppError('RULE_VIOLATION', `Choose a file of the same kind: ${kind}.`, {
    reason: 'relink_kind_mismatch',
  })
}

// The candidate is used only when it is a regular file (not a link) whose real place is
// still inside the new folder and whose content is the row's own.
async function follow(project: ProjectHandle, row: AssetRow, candidate: string, newDir: string) {
  const [real, realDir, stat] = await Promise.all([
    fs.promises.realpath(candidate),
    fs.promises.realpath(newDir),
    fs.promises.lstat(candidate),
  ])
  if (!stat.isFile() || pathInside(realDir, real) === null) return null
  if ((await hashFile(real)) !== row.contentHash) return null
  return {
    id: row.id,
    contentHash: row.contentHash,
    absPath: candidate,
    relPath: relativeToProject(project.filePath, candidate),
    byteSize: stat.size,
    mtimeMs: Math.trunc(stat.mtimeMs),
  }
}

async function sibling(
  project: ProjectHandle,
  row: AssetRow,
  named: AssetRow,
  newFile: string,
): Promise<SiblingMove | null> {
  const place = siblingCandidate(named.absPath, newFile, row.absPath)
  if (row.storage !== 'linked' || place === null) return null
  if ((await resolveRow(project, row)) !== 'missing') return null
  try {
    return await follow(project, row, place.candidate, place.newDir)
  } catch {
    return null
  }
}

async function findSiblings(project: ProjectHandle, named: AssetRow, newFile: string) {
  const rows = (readWireRows(project.db, 'asset') as AssetRow[])
    .filter((r) => r.id !== named.id)
    .sort((a, b) => (a.id < b.id ? -1 : 1))
  const found = await Promise.all(rows.map((r) => sibling(project, r, named, newFile)))
  return found.filter((s): s is SiblingMove => s !== null)
}

export async function prepareRelink(
  project: ProjectHandle,
  input: AssetRelinkInput,
): Promise<PreparedRelink> {
  const row = readWireRow(project.db, 'asset', { id: input.assetId }) as AssetRow | null
  if (!row) throw assetNotFound()
  const facts = await readFileFacts(input.newPath)
  const { type } = facts
  if (type?.kind !== row.kind) throw kindMismatch(row.kind)
  const siblings = input.relinkSiblings ? await findSiblings(project, row, facts.file) : []
  return {
    file: { ...facts, type },
    relPath: relativeToProject(project.filePath, facts.file),
    siblings,
  }
}
