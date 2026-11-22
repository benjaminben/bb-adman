// The file side of asset.checkChanged (SPEC 14, Slice A rulings point 2b; FR-009, R-06).
// Only linked assets whose file is found are looked at; a file is read again only when its
// size or time differs from the row. Missing files are the resolver's, not this check's.
import fs from 'node:fs'
import type { ProjectHandle } from '@/main/db/project-file'
import { readWireRows } from '@/main/db/rows'
import { readFileFacts, type FileFacts } from './inspect'
import { resolveRow } from './service'
import type { AssetRow } from '@/shared/schemas/rows/asset'

export type ChangedFile = { id: string; facts: FileFacts }

async function changed(project: ProjectHandle, row: AssetRow): Promise<ChangedFile | null> {
  if (row.storage !== 'linked') return null
  const file = await resolveRow(project, row)
  if (file === 'missing') return null
  try {
    const stat = await fs.promises.stat(file)
    if (stat.size === row.byteSize && Math.trunc(stat.mtimeMs) === row.mtimeMs) return null
    return { id: row.id, facts: await readFileFacts(file) }
  } catch {
    // Gone or unreadable since the resolver found it: the next check looks again.
    return null
  }
}

export async function prepareCheckChanged(project: ProjectHandle): Promise<ChangedFile[]> {
  const rows = (readWireRows(project.db, 'asset') as AssetRow[]).sort((a, b) =>
    a.id < b.id ? -1 : 1,
  )
  const found = await Promise.all(rows.map((r) => changed(project, r)))
  return found.filter((c): c is ChangedFile => c !== null)
}

// What run writes for one changed file, and whether its content changed.
export function changePatch(row: AssetRow, facts: FileFacts) {
  const { byteSize, mtimeMs, contentHash } = facts
  if (contentHash === row.contentHash) return { patch: { byteSize, mtimeMs }, outcome: 'time' }
  if (facts.type?.kind === row.kind) {
    const { width, height, durationMs, fontFamily } = facts
    const patch = {
      mime: facts.type.mime,
      byteSize,
      mtimeMs,
      contentHash,
      width,
      height,
      durationMs,
      fontFamily,
    }
    return { patch, outcome: 'content' }
  }
  const cleared = { width: null, height: null, durationMs: null, fontFamily: null }
  const patch = { byteSize, mtimeMs, contentHash, ...cleared }
  return { patch, outcome: 'other kind' }
}
