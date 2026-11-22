// clip.swap (spec/phases/round-2-editor.md D5): the inverse of a generated clip that took a
// still's place, and of itself. It removes the named clips of the variant and writes the rows
// in one write. Each row is checked as clip.restore checks it: the schema's bounds, a usable
// asset of this project, a trim inside a video's file, this variant, and no overlap with the
// clips left on the track. Its inverse is the swap the other way. System command: deny and
// internal, so no window and no agent can send it.
import { defineCommand, type ProjectContext } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import type { CommandCall } from '@/main/history/undo-lists'
import { clipAssetOf } from '@/main/clips/clip-asset'
import { checkClip, clipsOf, readClip, readVariant, writeClips } from '@/main/clips/write-clip'
import { clipSwapInput, type ClipSwapReply } from '@/shared/schemas/commands/clip'
import type { BackgroundClipRow } from '@/shared/schemas/rows/background-clip'
import { AppError } from '@/shared/schemas/result'

const badSwap = () =>
  new AppError('INVALID_INPUT', 'These clips cannot be swapped on the track as they are.')

// Inside the transaction: the removed rows off the variant's track and the put rows on it, as
// one write with one rev bump. The rows are checked first, so a refusal writes nothing. The
// answer is the inverse call: the swap the other way.
export function swapClips(
  ctx: ProjectContext,
  projectId: string,
  removed: BackgroundClipRow[],
  put: BackgroundClipRow[],
  now: string,
): CommandCall {
  const db = ctx.project.db
  const variantId = removed[0]?.variantId ?? ''
  const gone = new Set(removed.map((r) => r.id))
  const sameVariant = [...removed, ...put].every((r) => r.variantId === variantId)
  // A put row's ID is new, or names a clip this swap removes.
  const freeIds = put.every((r) => gone.has(r.id) || readClip(db, r.id) === null)
  if (!sameVariant || !freeIds) throw badSwap()
  const track = [...clipsOf(db, variantId).filter((c) => !gone.has(c.id)), ...put]
  for (const row of put) checkClip(row, clipAssetOf(db, row.assetId), track)
  const remove = db.prepare('DELETE FROM background_clip WHERE id = ?')
  for (const row of removed) {
    remove.run(row.id)
    ctx.changes.touch('background_clip', { id: row.id })
  }
  writeClips(ctx, put, now)
  return {
    name: 'clip.swap',
    input: { projectId, variantId, remove: put.map((r) => r.id), put: removed },
  }
}

export function clipSwap(deps: CoreDeps) {
  return defineCommand({
    name: 'clip.swap',
    internal: true,
    input: clipSwapInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const db = ctx.project.db
      if (!readVariant(db, input.variantId)) {
        throw new AppError('NOT_FOUND', 'That variant was not found.')
      }
      const removed = input.remove.map((id) => readClip(db, id))
      const own = removed.filter(
        (r): r is BackgroundClipRow => r !== null && r.variantId === input.variantId,
      )
      if (own.length !== input.remove.length) throw badSwap()
      const call = swapClips(ctx, input.projectId, own, input.put, deps.now().toISOString())
      const reply: ClipSwapReply = { clipIds: input.put.map((r) => r.id) }
      return {
        data: reply,
        log: { variantId: input.variantId },
        inverse: { scope: `variant:${input.variantId}`, call },
      }
    },
  })
}
