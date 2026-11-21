// P5-4 (spec/links-and-sync.md, "Adding back and removing variants"): snapshot.ts reads a whole
// variant, deletes it and writes it back, and the stored rows come back column by column.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type Database from 'better-sqlite3'
import type { ProjectContext } from '@/main/commands/types'
import { createChangeRecorder } from '@/main/commands/change-recorder'
import { deleteVariants, readSnapshot, writeSnapshot } from '@/main/links/snapshot'
import { makeVariantBus, V2, type VariantBus } from './variant-fixture'

let bus: VariantBus
beforeEach(async () => {
  bus = await makeVariantBus()
})
afterEach(() => bus.cleanup())

const TABLES: Array<[string, string]> = [
  ['variant', 'id = ?'],
  ['variant_subject', 'variant_id = ?'],
  ['layer', 'variant_id = ?'],
  ['background_clip', 'variant_id = ?'],
]

function stored(db: Database.Database, id: string) {
  return TABLES.map(([table, where]) =>
    db.prepare(`SELECT * FROM ${table} WHERE ${where} ORDER BY rowid`).all(id),
  )
}

function context(): ProjectContext {
  const project = bus.projects.requireOpen(bus.projectId)
  return { actor: 'user', commandId: 'c1', project, changes: createChangeRecorder() }
}

describe('snapshot.ts [P5-4]', () => {
  it('read, then delete, then write gives the stored rows back column by column', () => {
    const before = stored(bus.db, V2)
    expect(before.every((rows) => rows.length > 0)).toBe(true)
    const snapshot = readSnapshot(bus.db, V2)
    if (!snapshot) throw new Error('no snapshot')
    const ctx = context()
    bus.db.transaction(() => deleteVariants(ctx, [V2]))()
    expect(stored(bus.db, V2).every((rows) => rows.length === 0)).toBe(true)
    bus.db.transaction(() => writeSnapshot(ctx, snapshot))()
    const after = stored(bus.db, V2)
    const sortById = (rows: unknown[]) =>
      [...(rows as Array<Record<string, unknown>>)].sort((a, b) =>
        String(a.id ?? a.subject_id).localeCompare(String(b.id ?? b.subject_id)),
      )
    expect(after.map(sortById)).toEqual(before.map(sortById))
  })

  it('reads nothing for an unknown variant', () => {
    expect(readSnapshot(bus.db, 'no-such')).toBeNull()
  })

  it('leaves the master and its rows alone when another variant is deleted', () => {
    const master = stored(bus.db, bus.masterId)
    bus.db.transaction(() => deleteVariants(context(), [V2]))()
    expect(stored(bus.db, bus.masterId)).toEqual(master)
  })
})
