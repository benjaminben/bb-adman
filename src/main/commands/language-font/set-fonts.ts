// layer.setFonts (spec/phases/phase-06.md, design addition 6; A-166). A font per language:
// writes style.fontAssetId on each named text layer through writeLayer, so the counters and
// the override rule are layer.update's. Every layer must be a text layer of one campaign and a
// font must pass the layer asset check; every check runs before any write. Bumps variant.rev
// once per variant changed. Agent policy allow. Its own inverse, on the campaign's list: the
// changed items with the fonts read from the database before the write.
import type Database from 'better-sqlite3'
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import { bumpVariantRev } from '@/main/commands/variant-rev'
import { checkLayerAssets } from '@/main/commands/layer/check-layer-assets'
import { inversePatch } from '@/main/commands/layer/inverse-patch'
import { mergePatch, type PatchKey } from '@/main/commands/layer/merge-patch'
import { namedOnce } from '@/main/commands/layer/update-many'
import { overridesAfter, writeLayer } from '@/main/commands/layer/write-layer'
import type { CoreDeps } from '@/main/core-deps'
import { readWireRow } from '@/main/db/rows'
import {
  layerSetFontsInput,
  type LayerFontItem,
  type LayerSetFontsReply,
} from '@/shared/schemas/commands/language-font'
import type { TextStyle } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { AppError } from '@/shared/schemas/result'

const NAME = 'layer.setFonts'

function campaignOf(db: Database.Database, variantId: string): string | undefined {
  const row = db
    .prepare(
      `SELECT d.campaign_id AS campaignId FROM variant v JOIN direction d ON d.id = v.direction_id
       WHERE v.id = ?`,
    )
    .get(variantId) as { campaignId: string } | undefined
  return row?.campaignId
}

// The stored text layers, in input order, and their one campaign.
function readLayers(db: Database.Database, items: LayerFontItem[]) {
  namedOnce(items.map((item) => item.layerId))
  const rows = items.map(({ layerId }) => {
    const row = readWireRow(db, 'layer', { id: layerId }) as LayerRow | null
    if (!row) throw new AppError('NOT_FOUND', 'That layer was not found.')
    if (row.type !== 'text') throw new AppError('INVALID_INPUT', 'Fonts are for text layers.')
    return row
  })
  const campaigns = new Set(rows.map((row) => campaignOf(db, row.variantId)))
  const [campaignId] = campaigns
  if (campaigns.size !== 1 || !campaignId) {
    throw new AppError('INVALID_INPUT', 'These layers are in different campaigns.')
  }
  return { rows, campaignId }
}

export function layerSetFonts(deps: CoreDeps) {
  return defineCommand({
    name: NAME,
    input: layerSetFontsInput,
    projectId: (input) => input.projectId,
    run(ctx, input): HandlerResult<LayerSetFontsReply> {
      const db = ctx.project.db
      const { rows, campaignId } = readLayers(db, input.items)
      const planned = rows.map((row, i) => {
        const patch = { style: { fontAssetId: input.items[i]?.fontAssetId ?? null } }
        checkLayerAssets(db, patch)
        const merged = mergePatch(row, patch)
        return { row, merged, inverse: inversePatch(row, merged) }
      })
      const changed = planned.filter((item) => Object.keys(item.inverse).length > 0)
      const result = { data: { layerIds: changed.map((item) => item.row.id) }, log: { campaignId } }
      if (changed.length === 0) return result
      const lists = changed.map((item) => overridesAfter(db, item.row, item.inverse))
      changed.forEach(({ row, merged, inverse }, i) => {
        writeLayer(ctx, row, merged, Object.keys(inverse) as PatchKey[], lists[i] ?? undefined)
      })
      const now = deps.now().toISOString()
      for (const variantId of new Set(changed.map((item) => item.row.variantId))) {
        bumpVariantRev(ctx, variantId, now)
      }
      const items = changed.map(({ row }) => ({
        layerId: row.id,
        fontAssetId: (row.style as TextStyle).fontAssetId ?? null,
      }))
      const call = { name: NAME, input: { projectId: input.projectId, items } }
      return { ...result, inverse: { scope: `campaign:${campaignId}`, call } }
    },
  })
}
