// variant.restore (spec/links-and-sync.md, "Adding back and removing variants"): system
// command, the inverse of variant.delete and variant.remove. Agent policy deny. Its input is
// a snapshot the main process wrote into an undo entry; it is still checked whole against
// this project's file before any write, and refused when anything it needs has changed.
import type Database from 'better-sqlite3'
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { writeSnapshot } from '@/main/links/snapshot'
import type { VariantSnapshot } from '@/shared/schemas/links'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { variantRestoreInput, type VariantsReply } from '@/shared/schemas/commands/variant'
import { AppError } from '@/shared/schemas/result'
import { ONE_CAMPAIGN } from './remove'

const exists = () =>
  new AppError('RULE_VIOLATION', 'That variant is already there.', { reason: 'variant_exists' })
const NOT_OWN = 'A row in this snapshot belongs to another variant.'

// Refuses when an asset a layer names is not in this project (its source or its font).
export function refuseMissingAssets(db: Database.Database, assetIds: Array<string | null>): void {
  for (const id of assetIds) {
    if (id === null) continue
    if (!db.prepare('SELECT 1 FROM asset WHERE id = ?').get(id)) {
      throw new AppError('NOT_FOUND', 'A file this variant used is no longer in the project.')
    }
  }
}

export function layerAssetIds(layer: LayerRow): Array<string | null> {
  const font = 'fontAssetId' in layer.style ? layer.style.fontAssetId : null
  return [layer.source?.assetId ?? null, typeof font === 'string' ? font : null]
}

// The campaign the snapshots go back into. Every check runs before any write.
function checkSnapshots(db: Database.Database, snapshots: VariantSnapshot[]): string {
  const campaigns = new Set<string>()
  const seen = new Set<string>()
  // True when the key came earlier in this same input.
  const taken = (key: string): boolean => {
    if (seen.has(key)) return true
    seen.add(key)
    return false
  }
  for (const { variant, layers, clips } of snapshots) {
    const id = variant.id
    if ([...layers, ...clips].some((r) => r.variantId !== id)) {
      throw new AppError('INVALID_INPUT', NOT_OWN)
    }
    const direction = db
      .prepare('SELECT campaign_id AS campaignId FROM direction WHERE id = ?')
      .get(variant.directionId) as { campaignId: string } | undefined
    if (!direction) throw new AppError('NOT_FOUND', 'That direction was not found.')
    campaigns.add(direction.campaignId)
    const grid = `${variant.directionId} ${variant.sizeLabel} ${variant.language} ${variant.format}`
    if (taken(`v ${id}`) || taken(`g ${grid}`)) throw exists()
    if (db.prepare('SELECT 1 FROM variant WHERE id = ?').get(id)) throw exists()
    const place = db
      .prepare(
        `SELECT 1 FROM variant WHERE direction_id = ? AND size_label = ? AND language = ?
         AND format = ?`,
      )
      .get(variant.directionId, variant.sizeLabel, variant.language, variant.format)
    if (place) throw exists()
    for (const layer of layers) {
      if (taken(`l ${layer.id}`) || db.prepare('SELECT 1 FROM layer WHERE id = ?').get(layer.id)) {
        throw exists()
      }
      refuseMissingAssets(db, layerAssetIds(layer))
    }
    for (const clip of clips) {
      const used = db.prepare('SELECT 1 FROM background_clip WHERE id = ?').get(clip.id)
      if (taken(`c ${clip.id}`) || used) throw exists()
      refuseMissingAssets(db, [clip.assetId])
    }
  }
  const [campaignId] = campaigns
  if (campaigns.size !== 1 || !campaignId) throw new AppError('INVALID_INPUT', ONE_CAMPAIGN)
  return campaignId
}

export function variantRestore(_deps: CoreDeps) {
  return defineCommand({
    name: 'variant.restore',
    internal: true,
    input: variantRestoreInput,
    projectId: (input) => input.projectId,
    run(ctx, input): HandlerResult<VariantsReply> {
      const campaignId = checkSnapshots(ctx.project.db, input.snapshots)
      for (const snapshot of input.snapshots) writeSnapshot(ctx, snapshot)
      const variantIds = input.snapshots.map((s) => s.variant.id)
      const call = { name: 'variant.remove', input: { projectId: input.projectId, variantIds } }
      return {
        data: { variantIds },
        log: { campaignId },
        inverse: { scope: `campaign:${campaignId}`, call },
      }
    },
  })
}
