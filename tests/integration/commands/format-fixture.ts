// Test helper for variant.setFormat and durationMs (P7-10): the clip bus, a background picture
// P1 on the master's background layer, and variants copied with rows directly (so Phase 5's
// fan-out is not needed). Not a test file itself.
import type Database from 'better-sqlite3'
import { ulid } from 'ulid'
import { makeClipBus } from './clip-fixture'

export { TEST_NOW } from './clip-fixture'

export type FormatBus = Awaited<ReturnType<typeof makeFormatBus>>

type Over = { sizeLabel?: string; language?: string; format?: 'image' | 'video' }

function columns(db: Database.Database, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(
    (c) => c.name,
  )
}

// A copy of one row, with some columns replaced by bound values.
function copyRow(
  db: Database.Database,
  table: string,
  id: string,
  over: Record<string, string | number>,
): void {
  const cols = columns(db, table)
  const picks = cols.map((c) => (c in over ? `@${c}` : c)).join(', ')
  db.prepare(
    `INSERT INTO ${table} (${cols.join(', ')}) SELECT ${picks} FROM ${table} WHERE id = @from`,
  ).run({ ...over, from: id })
}

export async function makeFormatBus() {
  const bus = await makeClipBus()
  bus.addAsset({ id: 'P1' })
  const db = bus.db
  const setSource = (assetId: string | null, variantId = bus.variantId) =>
    db
      .prepare("UPDATE layer SET source = ? WHERE variant_id = ? AND type = 'background'")
      .run(assetId ? JSON.stringify({ assetId }) : null, variantId)
  setSource('P1')

  // A variant of the master's direction copied from the master with its layers: a linked
  // variant at another size by default.
  function copyVariant(over: Over = {}): string {
    const id = ulid()
    copyRow(db, 'variant', bus.variantId, {
      id,
      size_label: over.sizeLabel ?? 'story',
      ...(over.language ? { language: over.language } : {}),
      ...(over.format ? { format: over.format } : {}),
      rev: 0,
    })
    const layers = db
      .prepare('SELECT id FROM layer WHERE variant_id = ?')
      .all(bus.variantId) as Array<{ id: string }>
    for (const layer of layers) copyRow(db, 'layer', layer.id, { id: ulid(), variant_id: id })
    return id
  }

  const master = () =>
    (db.prepare('SELECT master_variant_id AS id FROM direction LIMIT 1').get() as { id: string }).id

  return {
    ...bus,
    setSource,
    copyVariant,
    master,
    setFormat: (format: string, variantId = bus.variantId, actor: 'user' | 'agent' = 'user') =>
      (actor === 'user' ? bus.user : bus.agent)('variant.setFormat', { variantId, format }),
    historyOf: (direction: 'undo' | 'redo', variantId: string) =>
      bus.user(`history.${direction}`, { scope: `variant:${variantId}` }),
    undoStateOf: (variantId: string) => bus.undo.state(bus.projectId, `variant:${variantId}`),
  }
}
