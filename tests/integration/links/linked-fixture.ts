// Test helper for Phase 5 links (spec/links-and-sync.md): writes linked variants of a master by
// hand, so a test needs no fan-out. Not a test file itself.
import type Database from 'better-sqlite3'
import { readWireRow, readWireRows } from '@/main/db/rows'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantRow } from '@/shared/schemas/rows/variant'

export type LinkedOptions = { width?: number; height?: number; language?: string }

const columnsOf = (db: Database.Database, table: string) =>
  (db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>).map((c) => c.name)

// Copies the row of `table` with this ID under the values in `set` (column names as stored).
export function copyRow(
  db: Database.Database,
  table: string,
  id: string,
  set: Record<string, string | number>,
): void {
  const names = columnsOf(db, table)
  const pick = names.map((n) => (n in set ? '?' : `"${n}"`)).join(', ')
  const values = names.filter((n) => n in set).map((n) => set[n])
  db.prepare(
    `INSERT INTO "${table}" (${names.map((n) => `"${n}"`).join(', ')})
     SELECT ${pick} FROM "${table}" WHERE id = ?`,
  ).run(...values, id)
}

// The layers of one variant, in stored order.
export const layersOf = (db: Database.Database, variantId: string) =>
  (readWireRows(db, 'layer') as LayerRow[]).filter((l) => l.variantId === variantId)

// The ID the fixture gives a linked variant's layer.
export const linkedLayerId = (variantId: string, key: string) => `${variantId}-${key}`

// A variant in the master's direction, at the given size and language (the master's when not
// given), with a linked copy of every master layer, synced to the master and with no
// overrides. Answers the new variant's layers.
export function addLinkedVariant(
  db: Database.Database,
  masterVariantId: string,
  variantId: string,
  options: LinkedOptions = {},
): LayerRow[] {
  const master = readWireRow(db, 'variant', { id: masterVariantId }) as VariantRow
  const width = options.width ?? master.width
  const height = options.height ?? master.height
  const language = options.language ?? master.language
  const sizeLabel = `${variantId} ${width}x${height}`
  const set = { id: variantId, width, height, language, size_label: sizeLabel, rev: 0 }
  copyRow(db, 'variant', masterVariantId, set)
  for (const layer of layersOf(db, masterVariantId)) {
    const id = linkedLayerId(variantId, layer.key)
    copyRow(db, 'layer', layer.id, { id, variant_id: variantId })
  }
  db.prepare(
    `UPDATE layer SET linked = 1, synced_revs = revs, overrides = '[]' WHERE variant_id = ?`,
  ).run(variantId)
  return layersOf(db, variantId)
}
