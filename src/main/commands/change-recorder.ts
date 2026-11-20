import type { ChangeRecorder } from './types'

// Collects the rows a command changed or removed, by table, for project.changed (SPEC 4.4).
export function createChangeRecorder(): ChangeRecorder & {
  collect(): {
    empty: boolean
    rows: { changed: Record<string, unknown[]>; removed: Record<string, string[]> }
  }
} {
  const changed: Record<string, unknown[]> = {}
  const removed: Record<string, string[]> = {}
  return {
    changed(table, row) {
      ;(changed[table] ??= []).push(row)
    },
    removed(table, id) {
      ;(removed[table] ??= []).push(id)
    },
    collect() {
      const empty = Object.keys(changed).length === 0 && Object.keys(removed).length === 0
      return { empty, rows: { changed, removed } }
    },
  }
}
