// asset.remove (SPEC 4.2; FR-197). Not undoable. Refused while a layer (its picture or its
// font), a background clip or a rule set uses the asset (SPEC 3.10, 14 contracts A and C).
// The file itself is left where it is: a file no asset row names is not an asset (SPEC 3.9).
import type Database from 'better-sqlite3'
import { eq } from 'drizzle-orm'
import { defineCommand } from '../types'
import { asset } from '../../db/schema'
import { readWireRows } from '../../db/rows'
import { requireAsset } from './update'
import { assetRemoveInput } from '../../../shared/schemas/commands/asset'
import { AppError } from '../../../shared/schemas/result'
import type { LayerRow } from '../../../shared/schemas/rows/layer'
import type { RuleSetRow } from '../../../shared/schemas/rows/rule-set'

const IN_USE = 'This file is in use. Take it off every post and out of every rule set first.'

function inUse(db: Database.Database, assetId: string): boolean {
  const layers = readWireRows(db, 'layer') as LayerRow[]
  const onLayer = layers.some(
    (l) =>
      l.source?.assetId === assetId ||
      ('fontAssetId' in l.style && l.style.fontAssetId === assetId),
  )
  const inClip = readWireRows(db, 'background_clip').some((c) => c.assetId === assetId)
  const ruleSets = readWireRows(db, 'rule_set') as RuleSetRow[]
  const required = ruleSets.some((r) => r.requiredAssetIds.includes(assetId))
  return onLayer || inClip || required
}

export function assetRemove() {
  return defineCommand({
    name: 'asset.remove',
    input: assetRemoveInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      requireAsset(ctx, input.assetId)
      if (inUse(ctx.project.db, input.assetId)) throw new AppError('RULE_VIOLATION', IN_USE)
      ctx.changes.touch('asset', { id: input.assetId })
      ctx.project.orm.delete(asset).where(eq(asset.id, input.assetId)).run()
      return { data: { assetId: input.assetId } }
    },
  })
}
