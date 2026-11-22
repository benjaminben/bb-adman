// clip.reorder (spec/phases/phase-07.md, "Clips and the track", A-181): every clip of the
// variant, laid back to back from the earliest start in the given order, gaps closed. A layout
// equal to what is stored writes nothing and adds no undo entry. Undo V (inverse: clip.restore
// with every old row). Agent deny.
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { clipAssetOf } from '@/main/clips/clip-asset'
import { checkClip, clipsOf, readVariant, writeClips } from '@/main/clips/write-clip'
import { reorderLayout } from '@/shared/clips/track'
import { clipReorderInput, type ClipReorderReply } from '@/shared/schemas/commands/clip'
import { AppError } from '@/shared/schemas/result'

const notEveryClip = () =>
  new AppError('INVALID_INPUT', 'Name every clip of this post once, in the new order.')

export function clipReorder(deps: CoreDeps) {
  return defineCommand({
    name: 'clip.reorder',
    input: clipReorderInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const db = ctx.project.db
      if (!readVariant(db, input.variantId)) {
        throw new AppError('NOT_FOUND', 'That variant was not found.')
      }
      const before = clipsOf(db, input.variantId)
      const byId = new Map(before.map((c) => [c.id, c]))
      const clips = input.clipIds.flatMap((id) => byId.get(id) ?? [])
      if (clips.length !== input.clipIds.length || clips.length !== before.length) {
        throw notEveryClip()
      }
      const layout = reorderLayout(clips)
      const after = clips.map((c, i) => ({ ...c, startMs: layout[i]?.startMs ?? c.startMs }))
      const moved = after.filter((c) => c.startMs !== byId.get(c.id)?.startMs)
      const reply: ClipReorderReply = { variantId: input.variantId }
      const result = { data: reply, log: { variantId: input.variantId } }
      if (moved.length === 0) return result
      for (const c of moved) checkClip(c, clipAssetOf(db, c.assetId), after)
      writeClips(ctx, moved, deps.now().toISOString())
      const call = { name: 'clip.restore', input: { projectId: input.projectId, rows: before } }
      return { ...result, inverse: { scope: `variant:${input.variantId}`, call } }
    },
  })
}
