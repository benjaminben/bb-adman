// Whether a project uses an asset (SPEC 14, Slice A rulings point 6): a layer's picture, a
// layer's font, a background clip, a rule set's required assets, a variant's sound file
// (A-184; the kept ID after leaving 'file' counts too). asset.remove and
// asset.update refuse with the same error.
import type Database from 'better-sqlite3'
import { readWireRows } from '@/main/db/rows'
import { AppError } from '@/shared/schemas/result'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { RuleSetRow } from '@/shared/schemas/rows/rule-set'

export function assetInUse(db: Database.Database, assetId: string): boolean {
  const layers = readWireRows(db, 'layer') as LayerRow[]
  const onLayer = layers.some(
    (l) =>
      l.source?.assetId === assetId ||
      ('fontAssetId' in l.style && l.style.fontAssetId === assetId),
  )
  const inClip = readWireRows(db, 'background_clip').some((c) => c.assetId === assetId)
  const ruleSets = readWireRows(db, 'rule_set') as RuleSetRow[]
  const required = ruleSets.some((r) => r.requiredAssetIds.includes(assetId))
  const asSound = db.prepare('SELECT 1 FROM variant WHERE sound_asset_id = ?').get(assetId)
  return onLayer || inClip || required || asSound !== undefined
}

export function assetInUseError(): AppError {
  return new AppError(
    'RULE_VIOLATION',
    'This file is in use. Take it off every post and out of every rule set first.',
    { reason: 'asset_in_use' },
  )
}
