// clip.restore (spec/phases/phase-07.md, "Clips and the track"): the inverse of clip.remove (one
// new row) and of clip.reorder (every row of the variant, written back over itself). System
// command: deny and internal, so no window and no agent can send it. It takes whole rows, so
// each is checked as the public commands check what they write: the schema's bounds, a usable
// asset of this project, a trim inside a video's file, one variant, and no overlap.
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { clipAssetOf } from '@/main/clips/clip-asset'
import { checkClip, clipsOf, readClip, readVariant, writeClips } from '@/main/clips/write-clip'
import { clipRestoreInput, type ClipRestoreReply } from '@/shared/schemas/commands/clip'
import type { BackgroundClipRow } from '@/shared/schemas/rows/background-clip'
import { AppError } from '@/shared/schemas/result'

const badRows = () =>
  new AppError('INVALID_INPUT', 'These clips cannot be put back on the track as they are.')

// Splits the rows into new ones and ones already on this variant's track (with their stored
// state). A restore is either one new row or rows that are all there.
function sortRows(
  rows: BackgroundClipRow[],
  stored: Map<string, BackgroundClipRow | null>,
): BackgroundClipRow[] {
  const before = rows.map((r) => stored.get(r.id) ?? null)
  const found = before.filter((r): r is BackgroundClipRow => r !== null)
  if (found.length === 0 && rows.length === 1) return []
  if (found.length !== rows.length) throw badRows()
  return found
}

export function clipRestore(deps: CoreDeps) {
  return defineCommand({
    name: 'clip.restore',
    internal: true,
    input: clipRestoreInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const db = ctx.project.db
      const { rows } = input
      const variantId = rows[0]?.variantId ?? ''
      const ids = new Set(rows.map((r) => r.id))
      if (ids.size !== rows.length || rows.some((r) => r.variantId !== variantId)) throw badRows()
      if (!readVariant(db, variantId))
        throw new AppError('NOT_FOUND', 'That variant was not found.')
      const stored = new Map(rows.map((r) => [r.id, readClip(db, r.id)]))
      if ([...stored.values()].some((r) => r && r.variantId !== variantId)) throw badRows()
      const before = sortRows(rows, stored)
      const track = [...clipsOf(db, variantId).filter((c) => !ids.has(c.id)), ...rows]
      for (const row of rows) checkClip(row, clipAssetOf(db, row.assetId), track)
      writeClips(ctx, rows, deps.now().toISOString())
      const reply: ClipRestoreReply = { clipIds: rows.map((r) => r.id) }
      const call =
        before.length === 0
          ? { name: 'clip.remove', input: { projectId: input.projectId, clipId: rows[0]?.id } }
          : { name: 'clip.restore', input: { projectId: input.projectId, rows: before } }
      return {
        data: reply,
        log: { variantId },
        inverse: { scope: `variant:${variantId}`, call },
      }
    },
  })
}
