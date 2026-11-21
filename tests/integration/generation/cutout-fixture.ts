// P4-11 helpers for the cut-out tests: give a seeded layer a picture, and the input of one
// generation.cutOut call on the background layer. Not a test file itself.
import type Database from 'better-sqlite3'
import { BACKGROUND_LAYER, VARIANT } from './generation-fixture'

export function givePicture(db: Database.Database, layerId: string, assetId: string): void {
  db.prepare('UPDATE layer SET source = ? WHERE id = ?').run(JSON.stringify({ assetId }), layerId)
}

export const cutOutInput = (extra: Record<string, unknown> = {}) => ({
  variantId: VARIANT,
  layerId: BACKGROUND_LAYER,
  provider: 'fake',
  ...extra,
})
