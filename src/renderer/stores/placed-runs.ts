// spec/phases/round-2-editor.md D6, "An empty layer gets the first picture" (R2E-5): the
// window's picture runs started from the Generate panel, one set per window.api (as
// layout-run.ts keeps its runs). When a run on a layer that was empty at its start succeeds,
// the finish reads variant.get; if the layer is there and still has no source, it sends one
// layer.update with the first kept picture and no crop, through window.api, so it is one undo
// entry like a user's own choice and a refusal reaches no banner. It runs once per run, while
// the window is open, whether or not the layer is shown. The latest rows of up to 20 picture
// jobs not yet registered are kept, for a command reply that comes after a job's first rows.
import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'
import { useApi } from '@/renderer/app/app-context'
import type { AdmanApi } from '@/shared/schemas/api'
import { imageJobResult } from '@/shared/schemas/jobs/image-generation'
import type { VariantGet } from '@/shared/schemas/queries/variant'
import type { JobRow } from '@/shared/schemas/rows/job'

export type PlacedRun = { projectId: string; variantId: string; layerId: string; wasEmpty: boolean }

// 'placing' until the finish of a run that started on an empty layer has settled; then
// 'placed' when its first picture went on the layer, else 'left'.
export type PlacedOutcome = 'placing' | 'placed' | 'left'

type Outcomes = { outcomes: Record<string, PlacedOutcome> }

type PlacedRuns = {
  store: StoreApi<Outcomes>
  register(jobId: string, run: PlacedRun): void
}

const EARLY_ROWS_KEPT = 20
const ended = (row: JobRow) => row.status !== 'queued' && row.status !== 'running'

// The first picture the run kept, if any.
export function firstKept(row: JobRow): string | null {
  const result = imageJobResult.safeParse(row.result)
  return result.success ? (result.data.assetIds[0] ?? null) : null
}

async function place(api: AdmanApi, run: PlacedRun, assetId: string): Promise<boolean> {
  const read = await api.query('variant.get', {
    projectId: run.projectId,
    variantId: run.variantId,
  })
  const layers = read.ok ? ((read.data as VariantGet | null)?.layers ?? []) : []
  const layer = layers.find((l) => l.id === run.layerId)
  if (!layer || layer.source !== null) return false
  const reply = await api.command('layer.update', {
    projectId: run.projectId,
    layerId: run.layerId,
    patch: { source: { assetId }, geometry: { crop: null } },
  })
  return reply.ok
}

function createPlacedRuns(api: AdmanApi): PlacedRuns {
  const store = createStore<Outcomes>(() => ({ outcomes: {} }))
  const started = new Map<string, PlacedRun>()
  const early = new Map<string, JobRow>()

  const record = (jobId: string, outcome: PlacedOutcome) =>
    store.setState({ outcomes: { ...store.getState().outcomes, [jobId]: outcome } })

  function settle(row: JobRow, run: PlacedRun) {
    if (!ended(row)) return
    started.delete(row.id)
    if (!run.wasEmpty) return
    const assetId = row.status === 'succeeded' ? firstKept(row) : null
    if (assetId === null) return record(row.id, 'left')
    void place(api, run, assetId).then(
      (placed) => record(row.id, placed ? 'placed' : 'left'),
      () => record(row.id, 'left'),
    )
  }

  api.on('job.updated', (row) => {
    if (row.kind !== 'image_generation') return
    const run = started.get(row.id)
    if (run) return settle(row, run)
    early.delete(row.id)
    early.set(row.id, row)
    const oldest = early.keys().next().value
    if (early.size > EARLY_ROWS_KEPT && oldest !== undefined) early.delete(oldest)
  })

  return {
    store,
    register(jobId, run) {
      if (run.wasEmpty) record(jobId, 'placing')
      started.set(jobId, run)
      const row = early.get(jobId)
      early.delete(jobId)
      if (row) settle(row, run)
    },
  }
}

const windowRuns = new WeakMap<AdmanApi, PlacedRuns>()

export function placedRunsFor(api: AdmanApi): PlacedRuns {
  const found = windowRuns.get(api)
  if (found) return found
  const runs = createPlacedRuns(api)
  windowRuns.set(api, runs)
  return runs
}

// The outcome of one run in this window; undefined for a run it did not register as empty.
export function usePlacedOutcome(jobId: string): PlacedOutcome | undefined {
  const runs = placedRunsFor(useApi())
  return useStore(runs.store, (s) => s.outcomes[jobId])
}
