// clip.addGenerated (spec/phases/phase-07.md, "Clips and the track", A-182): the video job's
// clip, sent through jc.system. It writes only into the job's own project; the variant comes
// from the job row; the asset must be a generated MP4 or MOV of this project in the asset
// library. The whole file goes at the first free position, whatever the variant's format, with
// no undo entry. D5 (spec/phases/round-2-editor.md): with replaceStill, the clip takes the
// place of the background's still when one fits, in one write with one undo entry whose
// inverse is clip.swap. A variant that is gone gives { clipId: null }, never a refusal. System
// command: deny and internal, so no window and no agent can send it.
import type Database from 'better-sqlite3'
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { prepareClipAsset, usableClipAsset, type ClipAsset } from '@/main/clips/clip-asset'
import { stillToReplace } from '@/main/clips/still-to-replace'
import {
  checkClip,
  clipsOf,
  newClip,
  placedClip,
  readVariant,
  writeClips,
} from '@/main/clips/write-clip'
import { readWireRow } from '@/main/db/rows'
import { clipAddGeneratedInput, type ClipAddGeneratedReply } from '@/shared/schemas/commands/clip'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import type { BackgroundClipRow } from '@/shared/schemas/rows/background-clip'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantRow } from '@/shared/schemas/rows/variant'
import { videoRefusal } from '@/shared/video/messages'
import { swapClips } from './swap'

const readAsset = (db: Database.Database, id: string) =>
  readWireRow(db, 'asset', { id }) as AssetRow | null

function backgroundAssetId(db: Database.Database, variantId: string): string | null {
  const found = db
    .prepare("SELECT id FROM layer WHERE variant_id = ? AND type = 'background' LIMIT 1")
    .get(variantId) as { id: string } | undefined
  const layer = found && (readWireRow(db, 'layer', { id: found.id }) as LayerRow | null)
  return layer?.source?.assetId ?? null
}

// The still and the clip in its place, or null when no still fits.
function replacement(
  db: Database.Database,
  variant: VariantRow,
  track: BackgroundClipRow[],
  asset: ClipAsset,
): { still: BackgroundClipRow; clip: BackgroundClipRow } | null {
  const plan = stillToReplace({
    track: track.map((c) => ({ ...c, picture: readAsset(db, c.assetId)?.kind === 'image' })),
    backgroundAssetId: backgroundAssetId(db, variant.id),
    fileMs: asset.durationMs ?? 0,
    postMs: variant.durationMs,
  })
  const still = plan && track.find((c) => c.id === plan.stillId)
  if (!plan || !still) return null
  return { still, clip: newClip(variant.id, asset.id, plan.startMs, plan.lengthMs) }
}

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
      const row = readAsset(db, input.assetId)
      if (row?.origin !== 'generated' || row.kind !== 'video') {
        throw videoRefusal('clip_asset_not_usable')
      }
      const asset = usableClipAsset(ctx, prepared)
      const track = clipsOf(db, variant.id)
      const now = deps.now().toISOString()
      const log = { variantId: variant.id }
      const swap = input.replaceStill === true ? replacement(db, variant, track, asset) : null
      if (swap) {
        const call = swapClips(ctx, input.projectId, [swap.still], [swap.clip], now)
        const reply: ClipAddGeneratedReply = { clipId: swap.clip.id, replacedStill: true }
        return { data: reply, log, inverse: { scope: `variant:${variant.id}`, call } }
      }
      const clip = placedClip(variant, track, asset)
      checkClip(clip, asset, track)
      writeClips(ctx, [clip], now)
      const reply: ClipAddGeneratedReply = { clipId: clip.id, replacedStill: false }
      return { data: reply, log }
    },
  })
}
