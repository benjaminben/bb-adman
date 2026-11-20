import type Database from 'better-sqlite3'
import type { ChangeRecorder } from './types'
import { readWireRow } from '../db/rows'
import { rowKey, type TableName } from '../../shared/schemas/rows/keys'
import type { ProjectChangedPayload } from '../../shared/schemas/events'

export type ProjectChanges = Pick<ProjectChangedPayload, 'changed' | 'removed'>

// Collects the rows a command names, then reads them back for project.changed (SPEC 4.4):
// a row that is there is changed, a row that is gone is removed. Each row appears once.
export function createChangeRecorder(): ChangeRecorder & {
  read(db: Database.Database): ProjectChanges | null
} {
  const touched = new Map<string, { table: TableName; key: Record<string, unknown> }>()
  return {
    touch(table, key) {
      touched.set(`${table} ${rowKey(table, key)}`, { table, key })
    },
    read(db) {
      if (touched.size === 0) return null
      const changes: ProjectChanges = { changed: {}, removed: {} }
      for (const { table, key } of touched.values()) {
        const row = readWireRow(db, table, key)
        if (row) (changes.changed[table] ??= []).push(row)
        else (changes.removed[table] ??= []).push(rowKey(table, key))
      }
      return changes
    },
  }
}
