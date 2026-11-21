// The activity panel's jobs (spec/screens-ai.md, "The activity panel", Store) [REQ: FR-152,
// FR-217, FR-218]: one store for the window. It reads job.activity for the shown project and
// keeps the rows by ID. job.updated carries no project ID, so a held row is replaced (its
// place kept) and any other row makes it read the query again. A reply older than the last
// read is dropped, and a held row as late as the reply's or later is kept, as the job store.
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { AdmanApi } from '@/shared/schemas/api'
import type { JobActivity } from '@/shared/schemas/queries/activity'
import type { JobRow } from '@/shared/schemas/rows/job'

export type ActivityEntry = JobActivity[number]

export type ActivityStoreState = {
  projectId: string | null
  rows: ActivityEntry[]
  open: boolean
  setOpen(open: boolean): void
  load(projectId: string | null): Promise<void>
  apply(row: JobRow): void
  subscribe(): () => void
}

export type ActivityStore = StoreApi<ActivityStoreState>

function laterOf(held: ActivityEntry[], entry: ActivityEntry): ActivityEntry {
  const mine = held.find((r) => r.job.id === entry.job.id)
  return mine && mine.job.updatedAt >= entry.job.updatedAt ? { ...entry, job: mine.job } : entry
}

export function createActivityStore(deps: { api: AdmanApi }): ActivityStore {
  let reads = 0

  return createStore<ActivityStoreState>((set, get) => ({
    projectId: null,
    rows: [],
    open: false,

    setOpen: (open) => set({ open }),

    async load(projectId) {
      const read = ++reads
      if (projectId !== get().projectId) set({ rows: [], projectId })
      if (projectId === null) return
      const result = await deps.api.query('job.activity', { projectId })
      if (read !== reads || !result.ok || !Array.isArray(result.data)) return
      set({ rows: (result.data as JobActivity).map((entry) => laterOf(get().rows, entry)) })
    },

    apply(row) {
      const rows = get().rows
      if (!rows.some((r) => r.job.id === row.id)) {
        void get().load(get().projectId)
        return
      }
      set({ rows: rows.map((r) => (r.job.id === row.id ? { ...r, job: row } : r)) })
    },

    subscribe() {
      return deps.api.on('job.updated', (row) => get().apply(row))
    },
  }))
}
