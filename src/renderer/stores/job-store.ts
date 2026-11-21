// The campaign page's runs (SPEC 14 1.41 TP-2 "The job store"): one store per open campaign
// page. It reads job.list for the chosen variant and keeps the rows by ID. job.updated
// carries no project ID, so a row whose ID the store holds, or whose ID a command just
// returned, is replaced; for any other row job.list is read again. It never guesses the
// project from a row.
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { AdmanApi } from '@/shared/schemas/api'
import type { JobStarted } from '@/shared/schemas/commands/job'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { Result } from '@/shared/schemas/result'
import { imageJobRequest, imageJobResult } from '@/shared/schemas/jobs/image-generation'

export type JobStoreState = {
  rows: JobRow[]
  variantId: string | null
  load(variantId: string): Promise<void>
  apply(row: JobRow): void
  // Takes a command's reply ({ jobId }, SPEC 4.2); a reply without one is ignored.
  track(reply: unknown): void
  markSeen(jobId: string): Promise<void>
  subscribe(): () => void
}

export type JobStore = StoreApi<JobStoreState>

export type JobStoreDeps = {
  api: AdmanApi
  command: (name: string, input: unknown) => Promise<Result<unknown>>
}

// The one place the window reads a picture job's asset IDs (SPEC 14 1.42 H-R1).
export function resultAssetIds(row: JobRow): string[] {
  const parsed = imageJobResult.safeParse(row.result)
  return parsed.success ? parsed.data.assetIds : []
}

// How many pictures a picture job asked for, for the paid confirm line of a retry.
export function requestCount(row: JobRow): number | null {
  const parsed = imageJobRequest.safeParse(row.request)
  return parsed.success ? parsed.data.count : null
}

function newestFirst(rows: JobRow[]): JobRow[] {
  return [...rows].sort((a, b) =>
    a.createdAt === b.createdAt ? b.id.localeCompare(a.id) : b.createdAt.localeCompare(a.createdAt),
  )
}

// F-10: a late job.list reply cannot turn a finished run back to "Working". The store's own row
// is kept when it is as late as the reply's or later.
function laterOf(held: JobRow[], row: JobRow): JobRow {
  const mine = held.find((r) => r.id === row.id)
  return mine && mine.updatedAt >= row.updatedAt ? mine : row
}

export function createJobStore(deps: JobStoreDeps, projectId: string): JobStore {
  const tracked = new Set<string>()
  const seenSent = new Set<string>()
  let reads = 0

  return createStore<JobStoreState>((set, get) => ({
    rows: [],
    variantId: null,

    async load(variantId) {
      const read = ++reads
      if (variantId !== get().variantId) set({ rows: [], variantId })
      const result = await deps.api.query('job.list', { projectId, variantId })
      if (read !== reads || !result.ok) return
      set({ rows: newestFirst((result.data as JobRow[]).map((row) => laterOf(get().rows, row))) })
    },

    apply(row) {
      const rows = get().rows
      if (!tracked.has(row.id) && !rows.some((r) => r.id === row.id)) {
        const variantId = get().variantId
        if (variantId !== null) void get().load(variantId)
        return
      }
      // A run started for a variant that is no longer chosen is not drawn under this one.
      const others = rows.filter((r) => r.id !== row.id)
      set({ rows: newestFirst(row.variantId === get().variantId ? [...others, row] : others) })
    },

    track(reply) {
      const jobId = (reply as Partial<JobStarted> | null)?.jobId
      if (typeof jobId === 'string') tracked.add(jobId)
    },

    async markSeen(jobId) {
      if (seenSent.has(jobId)) return
      seenSent.add(jobId)
      await deps.command('job.markSeen', { projectId, jobIds: [jobId] })
    },

    subscribe() {
      return deps.api.on('job.updated', (row) => get().apply(row))
    },
  }))
}
