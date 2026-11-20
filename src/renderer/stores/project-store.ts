// One store per project tab (ADR-003). It holds a copy of rows the main process sent
// and is updated only from project.changed events; nothing is applied optimistically.
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { AdmanApi } from '../../shared/schemas/api'
import type { Actor, ProjectChangedPayload } from '../../shared/schemas/events'

type Row = Record<string, unknown>

export type ProjectStoreState = {
  projectId: string
  tables: Record<string, Record<string, Row>>
  lastActor: Actor | null
  apply(payload: ProjectChangedPayload): void
  subscribe(): () => void
}

function rowId(row: Row): string {
  const id = row.id ?? row.key ?? row.variant_id ?? row.campaign_id
  return String(id)
}

export function createProjectStore(api: AdmanApi, projectId: string): StoreApi<ProjectStoreState> {
  return createStore<ProjectStoreState>((set, get) => ({
    projectId,
    tables: {},
    lastActor: null,

    apply(payload) {
      if (payload.projectId !== projectId) return
      const tables = { ...get().tables }
      for (const [table, rows] of Object.entries(payload.changed)) {
        const next = { ...tables[table] }
        for (const row of rows as Row[]) next[rowId(row)] = row
        tables[table] = next
      }
      for (const [table, ids] of Object.entries(payload.removed)) {
        const next = { ...tables[table] }
        for (const id of ids) delete next[id]
        tables[table] = next
      }
      set({ tables, lastActor: payload.actor })
    },

    subscribe() {
      return api.on('project.changed', (payload) => get().apply(payload))
    },
  }))
}
