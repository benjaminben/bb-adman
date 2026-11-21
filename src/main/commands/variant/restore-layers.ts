// variant.restoreLayers (spec/links-and-sync.md, "Adding back and removing variants"): system
// command, the inverse of sync.apply and generation.applyFill. Agent policy deny. Makes each
// variant's layer set exactly the given rows: layers not listed are deleted, changed ones are
// written whole, missing ones inserted. A master is refused, so its counters only go up. One
// variant.rev bump per variant. The inverse is the same command with the rows before it ran.
import { isDeepStrictEqual } from 'node:util'
import type Database from 'better-sqlite3'
import { defineCommand, type HandlerResult, type ProjectContext } from '@/main/commands/types'
import { insertLayerRow } from '@/main/commands/campaign/layer-row'
import { bumpVariantRev } from '@/main/commands/variant-rev'
import type { CoreDeps } from '@/main/core-deps'
import { readLayers } from '@/main/links/snapshot'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { variantRestoreLayersInput, type VariantsReply } from '@/shared/schemas/commands/variant'
import { AppError } from '@/shared/schemas/result'
import { ONE_CAMPAIGN } from './remove'
import { layerAssetIds, refuseMissingAssets } from './restore'

type Entry = { variantId: string; layers: LayerRow[] }

const NOT_OWN = 'A layer in this list belongs to another variant.'

// The campaign of the variants and their IDs as the file holds them. Every check runs before
// any write.
function check(db: Database.Database, entries: Entry[]): { campaignId: string; ids: string[] } {
  const campaigns = new Set<string>()
  const variants = new Set<string>()
  for (const { variantId, layers } of entries) {
    const row = db
      .prepare(
        `SELECT v.id, d.campaign_id AS campaignId, d.master_variant_id AS masterId
         FROM variant v JOIN direction d ON d.id = v.direction_id WHERE v.id = ?`,
      )
      .get(variantId) as { id: string; campaignId: string; masterId: string } | undefined
    if (!row) throw new AppError('NOT_FOUND', 'That variant was not found.')
    if (row.masterId === variantId) {
      throw new AppError('RULE_VIOLATION', "A master's layers cannot be put back this way.", {
        reason: 'master_variant',
      })
    }
    if (variants.has(row.id)) throw new AppError('INVALID_INPUT', 'A variant is listed twice.')
    variants.add(row.id)
    campaigns.add(row.campaignId)
    const ids = new Set<string>()
    for (const layer of layers) {
      const owner = db.prepare('SELECT variant_id AS v FROM layer WHERE id = ?').get(layer.id) as
        { v: string } | undefined
      const elsewhere = owner !== undefined && owner.v !== variantId
      if (layer.variantId !== variantId || elsewhere || ids.has(layer.id)) {
        throw new AppError('INVALID_INPUT', NOT_OWN)
      }
      ids.add(layer.id)
      refuseMissingAssets(db, layerAssetIds(layer))
    }
  }
  const [campaignId] = campaigns
  if (campaigns.size !== 1 || !campaignId) throw new AppError('INVALID_INPUT', ONE_CAMPAIGN)
  return { campaignId, ids: [...variants] }
}

// Deletes every row not wanted as it is, then inserts the rest, so two rows that swap keys
// never meet.
function writeLayers(ctx: ProjectContext, before: LayerRow[], wanted: LayerRow[]) {
  const db = ctx.project.db
  const was = new Map(before.map((l) => [l.id, l]))
  const keep = new Set(wanted.filter((l) => isDeepStrictEqual(was.get(l.id), l)).map((l) => l.id))
  for (const layer of before) {
    if (keep.has(layer.id)) continue
    db.prepare('DELETE FROM layer WHERE id = ?').run(layer.id)
    ctx.changes.touch('layer', { id: layer.id })
  }
  for (const layer of wanted) if (!keep.has(layer.id)) insertLayerRow(ctx, layer)
}

export function variantRestoreLayers(deps: CoreDeps) {
  return defineCommand({
    name: 'variant.restoreLayers',
    internal: true,
    input: variantRestoreLayersInput,
    projectId: (input) => input.projectId,
    run(ctx, input): HandlerResult<VariantsReply> {
      const db = ctx.project.db
      const { campaignId, ids: variantIds } = check(db, input.variants)
      const now = deps.now().toISOString()
      const earlier: Entry[] = []
      input.variants.forEach(({ layers }, i) => {
        const variantId = variantIds[i] ?? ''
        const before = readLayers(db, variantId)
        earlier.push({ variantId, layers: before })
        writeLayers(ctx, before, layers)
        bumpVariantRev(ctx, variantId, now)
      })
      const call = {
        name: 'variant.restoreLayers',
        input: { projectId: input.projectId, variants: earlier },
      }
      return {
        data: { variantIds },
        log: { campaignId },
        inverse: { scope: `campaign:${campaignId}`, call },
        clearScopes: variantIds.map((id) => `variant:${id}`),
      }
    },
  })
}
