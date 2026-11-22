// clip.addGenerated (spec/phases/phase-07.md, "Clips and the track", A-182): the video job's
// clip, sent through jc.system. It writes only into the job's own project; the variant comes
// from the job row; the asset must be a generated MP4 or MOV of this project in the asset
// library. The whole file goes at the first free position, whatever the variant's format. No
// undo entry. A variant that is gone gives { clipId: null }, never a refusal. System command:
// deny and internal, so no window and no agent can send it.
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { prepareClipAsset, usableClipAsset } from '@/main/clips/clip-asset'
import { checkClip, clipsOf, placedClip, readVariant, writeClips } from '@/main/clips/write-clip'
import { readWireRow } from '@/main/db/rows'
import { clipAddGeneratedInput, type ClipAddGeneratedReply } from '@/shared/schemas/commands/clip'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import { videoRefusal } from '@/shared/video/messages'

export function clipAddGenerated(deps: CoreDeps) {
  return defineCommand({
    name: 'clip.addGenerated',
    internal: true,
    input: clipAddGeneratedInput,
    projectId: (input) => input.projectId,
    prepare: (ctx, input) => prepareClipAsset(deps, ctx, input.assetId),
    run(ctx, input, prepared) {
      const db = ctx.project.db
      const variant = readVariant(db, input.variantId)
      const gone: ClipAddGeneratedReply = { clipId: null }
      if (!variant) return { data: gone }
      const row = readWireRow(db, 'asset', { id: input.assetId }) as AssetRow | null
      if (row?.origin !== 'generated' || row.kind !== 'video') {
        throw videoRefusal('clip_asset_not_usable')
      }
      const asset = usableClipAsset(ctx, prepared)
      const track = clipsOf(db, variant.id)
      const clip = placedClip(variant, track, asset)
      checkClip(clip, asset, track)
      writeClips(ctx, [clip], deps.now().toISOString())
      const reply: ClipAddGeneratedReply = { clipId: clip.id }
      return { data: reply, log: { variantId: variant.id } }
    },
  })
}
