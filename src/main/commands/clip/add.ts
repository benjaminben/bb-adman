// clip.add (spec/phases/phase-07.md, "Clips and the track", A-180): one clip on the variant's
// track. startMs left out: the first free position. lengthMs left out: a still runs to the
// variant's end (3,000 ms when none is left), a video runs its whole file. Prepare finds the
// file and reads a video's facts when its row has none. Undo V (inverse clip.remove).
// Agent deny.
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { prepareClipAsset, usableClipAsset } from '@/main/clips/clip-asset'
import {
  checkClip,
  clipsOf,
  defaultLength,
  newClip,
  readVariant,
  writeClips,
} from '@/main/clips/write-clip'
import { firstFreeStart } from '@/shared/clips/track'
import { clipAddInput, type ClipReply } from '@/shared/schemas/commands/clip'
import { AppError } from '@/shared/schemas/result'

export function clipAdd(deps: CoreDeps) {
  return defineCommand({
    name: 'clip.add',
    input: clipAddInput,
    projectId: (input) => input.projectId,
    prepare: (ctx, input) => prepareClipAsset(deps, ctx, input.assetId),
    run(ctx, input, prepared) {
      const db = ctx.project.db
      const variant = readVariant(db, input.variantId)
      if (!variant) throw new AppError('NOT_FOUND', 'That variant was not found.')
      const asset = usableClipAsset(ctx, prepared)
      const track = clipsOf(db, variant.id)
      const lengthAt = (startMs: number) => input.lengthMs ?? defaultLength(variant, asset, startMs)
      const startMs = input.startMs ?? firstFreeStart(track, lengthAt)
      const row = newClip(variant.id, asset.id, startMs, lengthAt(startMs))
      checkClip(row, asset, track)
      writeClips(ctx, [row], deps.now().toISOString())
      const reply: ClipReply = { clipId: row.id }
      const call = { name: 'clip.remove', input: { projectId: input.projectId, clipId: row.id } }
      return {
        data: reply,
        log: { variantId: variant.id },
        inverse: { scope: `variant:${variant.id}`, call },
      }
    },
  })
}
