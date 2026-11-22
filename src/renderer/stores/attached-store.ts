// spec/screens-ai.md, "Attached jobs and the close warning" [D-036, OI-31, OI-51]: the attached
// jobs this window started, each under its owner, a variant tab, a dialog or a campaign (P6-13).
// It follows job.updated; when a job ends it runs `finish` (the layout apply) if it succeeded,
// and forgets it. One store lives for the window, so a finish runs when its tab is not the one shown.
// A job's first rows can come before the command's reply registers it, so the latest row of
// each attached job not yet registered is kept for a while.
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { AdmanApi } from '@/shared/schemas/api'
import type { JobRow } from '@/shared/schemas/rows/job'
import { JOB_KIND_CLASSES, type JobKind } from '@/shared/config/job-kinds'

// Every owner names its project: job.cancel needs it. A campaign owns its translation jobs,
// so closing its tab warns (P6-13).
export type AttachedOwner =
  | { projectId: string; variantId: string }
  | { projectId: string; dialog: string }
  | { projectId: string; campaignId: string }

// kind and provider are null until the job's first row arrives.
export type AttachedJob = {
  jobId: string
  owner: AttachedOwner
  kind: JobKind | null
  provider: string | null
}

export type AttachedStoreState = {
  jobs: AttachedJob[]
  register(jobId: string, owner: AttachedOwner, finish?: () => void): void
  end(jobId: string): void
  apply(row: JobRow): void
  subscribe(): () => void
}

export type AttachedStore = StoreApi<AttachedStoreState>

const EARLY_ROWS_KEPT = 50

const ended = (row: JobRow) => row.status !== 'queued' && row.status !== 'running'

export function variantJobs(
  s: AttachedStoreState,
  projectId: string,
  variantIds: string[],
): AttachedJob[] {
  return s.jobs.filter(
    ({ owner }) =>
      owner.projectId === projectId && 'variantId' in owner && variantIds.includes(owner.variantId),
  )
}

export function dialogJobs(s: AttachedStoreState, dialog: string): AttachedJob[] {
  return s.jobs.filter(({ owner }) => 'dialog' in owner && owner.dialog === dialog)
}

export function campaignJobs(
  s: AttachedStoreState,
  projectId: string,
  campaignId: string,
): AttachedJob[] {
  return s.jobs.filter(
    ({ owner }) =>
      owner.projectId === projectId && 'campaignId' in owner && owner.campaignId === campaignId,
  )
}

export function createAttachedStore(api: AdmanApi): AttachedStore {
  const finishes = new Map<string, () => void>()
  const early = new Map<string, JobRow>()

  return createStore<AttachedStoreState>((set, get) => {
    function forget(jobId: string) {
      finishes.delete(jobId)
      set({ jobs: get().jobs.filter((j) => j.jobId !== jobId) })
    }

    function settle(row: JobRow) {
      const finish = finishes.get(row.id)
      forget(row.id)
      if (row.status === 'succeeded') finish?.()
    }

    function keepEarly(row: JobRow) {
      if (JOB_KIND_CLASSES[row.kind] !== 'attached') return
      early.delete(row.id)
      early.set(row.id, row)
      const oldest = early.keys().next().value
      if (early.size > EARLY_ROWS_KEPT && oldest !== undefined) early.delete(oldest)
    }

    return {
      jobs: [],

      register(jobId, owner, finish) {
        const row = early.get(jobId)
        early.delete(jobId)
        const job = { jobId, owner, kind: row?.kind ?? null, provider: row?.provider ?? null }
        set({ jobs: [...get().jobs.filter((j) => j.jobId !== jobId), job] })
        if (finish) finishes.set(jobId, finish)
        if (row && ended(row)) settle(row)
      },

      end: forget,

      apply(row) {
        const held = get().jobs.find((j) => j.jobId === row.id)
        if (!held) return keepEarly(row)
        if (ended(row)) return settle(row)
        if (held.kind === row.kind && held.provider === row.provider) return
        const job = { ...held, kind: row.kind, provider: row.provider }
        set({ jobs: get().jobs.map((j) => (j.jobId === row.id ? job : j)) })
      },

      subscribe() {
        return api.on('job.updated', (row) => get().apply(row))
      },
    }
  })
}

// The window's one store, made and subscribed on first use.
const windowStores = new WeakMap<AdmanApi, AttachedStore>()

export function attachedStoreFor(api: AdmanApi): AttachedStore {
  const found = windowStores.get(api)
  if (found) return found
  const store = createAttachedStore(api)
  store.getState().subscribe()
  windowStores.set(api, store)
  return store
}
