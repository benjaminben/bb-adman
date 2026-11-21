// A whole variant as one value (spec/links-and-sync.md, "Adding back and removing variants"):
// its row, its subjects, its layers and its clips. The one place that reads, writes or
// deletes a whole variant. Every read and write uses the command's own project file.
import type Database from 'better-sqlite3'
import type { ProjectContext } from '@/main/commands/types'
import { insertLayerRow } from '@/main/commands/campaign/layer-row'
import * as schema from '@/main/db/schema'
import { readWireRow, storedJson } from '@/main/db/rows'
import type { VariantSnapshot } from '@/shared/schemas/links'
import type { BackgroundClipRow } from '@/shared/schemas/rows/background-clip'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantRow } from '@/shared/schemas/rows/variant'

type Ids = Array<{ id: string }>

// A variant's layers in z order, read whole. A row that cannot be read throws, so a delete
// never removes what its undo could not bring back.
export function readLayers(db: Database.Database, variantId: string): LayerRow[] {
  const ids = db.prepare('SELECT id FROM layer WHERE variant_id = ? ORDER BY z, id').all(variantId)
  return (ids as Ids).map(({ id }) => readWireRow(db, 'layer', { id }) as LayerRow)
}

function readClips(db: Database.Database, variantId: string): BackgroundClipRow[] {
  const ids = db
    .prepare('SELECT id FROM background_clip WHERE variant_id = ? ORDER BY start_ms, id')
    .all(variantId)
  return (ids as Ids).map(
    ({ id }) => readWireRow(db, 'background_clip', { id }) as BackgroundClipRow,
  )
}

// Null when the variant is not there.
export function readSnapshot(db: Database.Database, variantId: string): VariantSnapshot | null {
  const variant = readWireRow(db, 'variant', { id: variantId }) as VariantRow | null
  if (!variant) return null
  const subjects = db
    .prepare(
      'SELECT subject_id AS id FROM variant_subject WHERE variant_id = ? ORDER BY subject_id',
    )
    .all(variantId) as Ids
  return {
    variant,
    subjectIds: subjects.map((s) => s.id),
    layers: readLayers(db, variantId),
    clips: readClips(db, variantId),
  }
}

// Removes the variants. The cascade takes their subjects, layers, clips and check; each
// removed row is named so the window hears of it (SPEC 4.4). Job rows stay (no foreign key).
export function deleteVariants(ctx: ProjectContext, variantIds: string[]): void {
  const db = ctx.project.db
  for (const variantId of variantIds) {
    for (const s of db
      .prepare('SELECT subject_id AS id FROM variant_subject WHERE variant_id = ?')
      .all(variantId) as Ids) {
      ctx.changes.touch('variant_subject', { variantId, subjectId: s.id })
    }
    for (const table of ['layer', 'background_clip'] as const) {
      for (const r of db.prepare(`SELECT id FROM ${table} WHERE variant_id = ?`).all(variantId)) {
        ctx.changes.touch(table, { id: (r as { id: string }).id })
      }
    }
    if (db.prepare('SELECT 1 FROM variant_check WHERE variant_id = ?').get(variantId)) {
      ctx.changes.touch('variant_check', { variantId })
    }
    db.prepare('DELETE FROM variant WHERE id = ?').run(variantId)
    ctx.changes.touch('variant', { id: variantId })
  }
}

// Writes a snapshot back exactly. The caller has checked it first (variant/restore.ts). A subject
// that is no longer in the project is left out, since its link has nothing to point at.
export function writeSnapshot(ctx: ProjectContext, snapshot: VariantSnapshot): void {
  const { orm, db } = ctx.project
  const v = snapshot.variant
  orm
    .insert(schema.variant)
    .values({
      ...v,
      durationOverridden: v.durationOverridden ? 1 : 0,
    })
    .run()
  ctx.changes.touch('variant', { id: v.id })
  for (const subjectId of snapshot.subjectIds) {
    if (!db.prepare('SELECT 1 FROM subject WHERE id = ?').get(subjectId)) continue
    orm.insert(schema.variantSubject).values({ variantId: v.id, subjectId }).run()
    ctx.changes.touch('variant_subject', { variantId: v.id, subjectId })
  }
  for (const layer of snapshot.layers) insertLayerRow(ctx, layer)
  for (const clip of snapshot.clips) {
    orm
      .insert(schema.backgroundClip)
      .values({ ...clip, placement: storedJson('background_clip', 'placement', clip.placement) })
      .run()
    ctx.changes.touch('background_clip', { id: clip.id })
  }
}
