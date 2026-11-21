// Test helper for slice A: rows that use an asset (a layer source, a layer font, a clip, a
// rule set's required list). Each passes its wire row schema. Not a test file itself.
import type Database from 'better-sqlite3'
import { insertCampaign } from '../row-fixtures'

const REVS = JSON.stringify({ copy: 0, style: 0, geometry: 0, source: 0, timing: 0, animation: 0 })
const GEOMETRY = JSON.stringify({ x: 0, y: 0, width: 10, height: 10, rotation: 0, crop: null })
const BLOCK = { preset: 'none', startMs: 0, durationMs: 0 }
const ANIMATION = JSON.stringify({ entrance: BLOCK, exit: BLOCK })
const TIMING = JSON.stringify({ startMs: 0, endMs: null })

export function seedVariant(db: Database.Database): void {
  insertCampaign(db, 'c1')
  db.exec(`
    INSERT INTO direction (id, campaign_id, name, master_variant_id, sort)
      VALUES ('d1', 'c1', 'D', 'v23456', 0);
    INSERT INTO variant (id, direction_id, title, width, height, size_label, language, format,
      duration_ms, created_by, created_at)
      VALUES ('v23456', 'd1', 'Master', 1080, 1080, '1:1', 'en', 'image', 0, 'user', 'x');
  `)
}

export function insertLayer(
  db: Database.Database,
  id: string,
  use: { sourceAssetId?: string; fontAssetId?: string },
): void {
  const text = use.fontAssetId !== undefined
  const style = text
    ? {
        fontAssetId: use.fontAssetId,
        fontSize: 40,
        fontWeight: 400,
        color: '#000000',
        align: 'left',
        lineHeight: 1.2,
        letterSpacing: 0,
      }
    : { opacity: 1 }
  const source = use.sourceAssetId ? JSON.stringify({ assetId: use.sourceAssetId }) : null
  db.prepare(
    `INSERT INTO layer (id, variant_id, key, type, slot, name, z, copy, style, geometry, source,
      timing, animation, revs, synced_revs)
     VALUES (?, 'v23456', ?, ?, NULL, 'L', 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    id,
    text ? 'text' : 'image',
    text ? 'Hello' : null,
    JSON.stringify(style),
    GEOMETRY,
    source,
    TIMING,
    ANIMATION,
    REVS,
    REVS,
  )
}

export function insertClip(db: Database.Database, assetId: string): void {
  db.prepare(
    `INSERT INTO background_clip (id, variant_id, asset_id, start_ms, in_ms, out_ms)
     VALUES ('clip1', 'v23456', ?, 0, 0, 1000)`,
  ).run(assetId)
}

export function insertRuleSet(db: Database.Database, requiredAssetIds: string[]): void {
  db.prepare('INSERT INTO rule_set (campaign_id, required_asset_ids) VALUES (?, ?)').run(
    'c1',
    JSON.stringify(requiredAssetIds),
  )
}
