// SPEC 4.4 test helper: copies every table before and after a command and checks that the
// project.changed event names exactly the difference, with each changed row as stored.
// Not a test file itself.
import { isDeepStrictEqual } from 'node:util'
import type Database from 'better-sqlite3'
import { expect } from 'vitest'
import { readWireRows } from '../../src/main/db/rows'
import { ROW_KEYS, rowKey, type TableName } from '../../src/shared/schemas/rows/keys'
import type { BusEvent } from '../../src/main/commands/bus'
import type { WireRow } from '../../src/shared/schemas/events'

type Snapshot = Map<TableName, Map<string, WireRow>>

const TABLES = Object.keys(ROW_KEYS) as TableName[]

function snapshot(db: Database.Database): Snapshot {
  return new Map(TABLES.map((t) => [t, new Map(readWireRows(db, t).map((r) => [rowKey(t, r), r]))]))
}

function difference(before: Snapshot, after: Snapshot) {
  const changed: Record<string, string[]> = {}
  const removed: Record<string, string[]> = {}
  for (const table of TABLES) {
    const was = before.get(table) ?? new Map<string, WireRow>()
    const now = after.get(table) ?? new Map<string, WireRow>()
    const c = [...now].filter(([k, r]) => !isDeepStrictEqual(was.get(k), r)).map(([k]) => k)
    const r = [...was.keys()].filter((k) => !now.has(k))
    if (c.length > 0) changed[table] = c.sort()
    if (r.length > 0) removed[table] = r.sort()
  }
  return { changed, removed }
}

export async function expectChanges<T>(
  target: { db: Database.Database; events: BusEvent[]; projectId: string },
  run: () => Promise<T>,
): Promise<T> {
  const before = snapshot(target.db)
  const start = target.events.length
  const result = await run()
  const after = snapshot(target.db)
  const diff = difference(before, after)
  const emitted = target.events
    .slice(start)
    .flatMap((e) =>
      e.name === 'project.changed' && e.payload.projectId === target.projectId ? [e.payload] : [],
    )
  if (Object.keys(diff.changed).length === 0 && Object.keys(diff.removed).length === 0) {
    expect(emitted).toEqual([])
    return result
  }
  expect(emitted).toHaveLength(1)
  const [payload] = emitted
  if (!payload) return result
  const changedKeys = Object.fromEntries(
    Object.entries(payload.changed).map(([t, rows]) => [
      t,
      (rows ?? []).map((r) => rowKey(t as TableName, r)).sort(),
    ]),
  )
  const removedKeys = Object.fromEntries(
    Object.entries(payload.removed).map(([t, keys]) => [t, [...(keys ?? [])].sort()]),
  )
  expect({ changed: changedKeys, removed: removedKeys }).toEqual(diff)
  for (const [t, rows] of Object.entries(payload.changed)) {
    for (const row of rows ?? []) {
      expect(row).toEqual(after.get(t as TableName)?.get(rowKey(t as TableName, row)))
    }
  }
  return result
}
