// One store per project tab (ADR-003). It holds a copy of rows the main process sent
// and is updated only from project.changed events; nothing is applied optimistically.
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { AdmanApi } from '../../shared/schemas/api'
import type { Actor, ProjectChangedPayload, WireRow } from '../../shared/schemas/events'
import { rowKey, type TableName } from '../../shared/schemas/rows/keys'

export type ProjectStoreState = {
  projectId: string
  tables: { [table in TableName]?: Record<string, WireRow> }
  lastActor: Actor | null
  apply(payload: ProjectChangedPayload): void
  subscribe(): () => void
}

export function createProjectStore(api: AdmanApi, projectId: string): StoreApi<ProjectStoreState> {
  return createStore<ProjectStoreState>((set, get) => ({
    projectId,
    tables: {},
    lastActor: null,

    apply(payload) {
      if (payload.projectId !== projectId) return
      const tables = { ...get().tables }
      for (const [name, rows] of Object.entries(payload.changed)) {
        const table = name as TableName
        const next = { ...tables[table] }
        for (const row of rows ?? []) next[rowKey(table, row)] = row
        tables[table] = next
      }
      for (const [name, keys] of Object.entries(payload.removed)) {
        const table = name as TableName
        const next = { ...tables[table] }
        for (const key of keys ?? []) delete next[key]
        tables[table] = next
      }
      set({ tables, lastActor: payload.actor })
    },

    subscribe() {
      return api.on('project.changed', (payload) => get().apply(payload))
    },
  }))
}
