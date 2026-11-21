// spec/screens-ai.md, "Place text with AI" [FR-061, workflow 5.1 step 6]: the run dialog sends
// generation.proposeLayout; the job is attached to the variant tab with a finish step that
// sends one layer.updateMany built by layoutPatches, also when the tab is not the one shown.
// The banner shows "Placing text with AI…" with Stop while the job runs, and a failure's
// sentence with Dismiss after. The window keeps the failures, so a tab shown again still has
// its line. A result whose variant was deleted while the call was out is dropped quietly.
import { useState } from 'react'
import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'
import { useApi, useApp } from '@/renderer/app/app-context'
import { attachedStoreFor, variantJobs } from '@/renderer/stores/attached-store'
import { layoutPatches } from '@/shared/generation/layout-patches'
import { fillMarks, plainMessage, reasonMessage } from '@/shared/providers/messages'
import type { AdmanApi } from '@/shared/schemas/api'
import { layoutJobResult } from '@/shared/schemas/jobs/layout-proposal'
import type { VariantGet } from '@/shared/schemas/queries/variant'
import type { Result } from '@/shared/schemas/result'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { LayerRow } from '@/shared/schemas/rows/layer'

export const NO_TEXT_HINT = 'Add text to a text layer first.'

type Target = { projectId: string; variantId: string }
type Started = Target & { label: string }

export type LayoutBannerLine =
  { kind: 'running'; onStop: () => void } | { kind: 'failed'; words: string; onDismiss: () => void }

// As generation.proposeLayout's own check: a visible text layer whose copy is not blank.
export function canPlaceText(layers: LayerRow[]): boolean {
  return layers.some((l) => l.type === 'text' && l.visible && (l.copy ?? '').trim() !== '')
}

export function failureWords(row: JobRow, label: string): string {
  const sentence = row.errorReason
    ? fillMarks(reasonMessage(row.errorReason), { provider: label })
    : plainMessage(row.errorKind ?? 'other', label)
  return `Text could not be placed. ${sentence}`
}

const keyOf = (t: Target) => `${t.projectId}:${t.variantId}`
const ended = (row: JobRow) => row.status !== 'queued' && row.status !== 'running'
const EARLY_ROWS_KEPT = 20

type Failures = { failures: Record<string, string> }

// The window's layout runs: the failure line per variant, and the jobs it started.
type LayoutRuns = {
  store: StoreApi<Failures>
  start(jobId: string, started: Started): void
  fail(target: Target, words: string | null): void
}

function createLayoutRuns(api: AdmanApi): LayoutRuns {
  const store = createStore<Failures>(() => ({ failures: {} }))
  const started = new Map<string, Started>()
  // A job's first rows can come before the command's reply.
  const early = new Map<string, JobRow>()

  function fail(target: Target, words: string | null) {
    const failures = { ...store.getState().failures }
    if (words === null) delete failures[keyOf(target)]
    else failures[keyOf(target)] = words
    store.setState({ failures })
  }

  function settle(row: JobRow, run: Started) {
    if (!ended(row)) return
    started.delete(row.id)
    if (row.status === 'failed') fail(run, failureWords(row, run.label))
  }

  api.on('job.updated', (row) => {
    if (row.kind !== 'layout_proposal') return
    const run = started.get(row.id)
    if (run) return settle(row, run)
    early.delete(row.id)
    early.set(row.id, row)
    const oldest = early.keys().next().value
    if (early.size > EARLY_ROWS_KEPT && oldest !== undefined) early.delete(oldest)
  })

  return {
    store,
    fail,
    start(jobId, run) {
      fail(run, null)
      started.set(jobId, run)
      const row = early.get(jobId)
      early.delete(jobId)
      if (row) settle(row, run)
    },
  }
}

const windowRuns = new WeakMap<AdmanApi, LayoutRuns>()

function layoutRunsFor(api: AdmanApi): LayoutRuns {
  const found = windowRuns.get(api)
  if (found) return found
  const runs = createLayoutRuns(api)
  windowRuns.set(api, runs)
  return runs
}

// The finish step. It reads the result and the variant's layers again, since the editor may
// be gone. A variant deleted while the call was out refuses with NOT_FOUND: nothing is shown.
// It sends through window.api, not the app store, so no refusal lands in the app's banner.
// Once the result is on the layers (or changes none), it sends job.markSeen (spec/jobs.md,
// "Finished, not yet looked at" [FR-218]); the finish runs once per job.
export async function applyLayout(api: AdmanApi, target: Target, jobId: string): Promise<void> {
  const runs = layoutRunsFor(api)
  const job = await api.query('job.get', { projectId: target.projectId, jobId })
  const result = job.ok ? layoutJobResult.safeParse((job.data as JobRow).result) : null
  if (!result?.success) return
  const read = await api.query('variant.get', target)
  if (!read.ok) return
  const updates = layoutPatches(result.data.boxes, (read.data as VariantGet).layers)
  const reply =
    updates.length === 0 ? null : await api.command('layer.updateMany', { ...target, updates })
  if (reply === null || reply.ok) {
    await api.command('job.markSeen', { projectId: target.projectId, jobIds: [jobId] })
  } else if (reply.error.code !== 'NOT_FOUND') {
    runs.fail(target, `Text could not be placed. ${reply.error.message}`)
  }
}

export function useLayoutRun(projectId: string, variantId: string, layers: LayerRow[]) {
  const api = useApi()
  const command = useApp((s) => s.command)
  const providers = useApp((s) => s.app?.providers)
  const [open, setOpen] = useState(false)
  const runs = layoutRunsFor(api)
  const attached = attachedStoreFor(api)
  const target = { projectId, variantId }
  const jobId = useStore(
    attached,
    (s) =>
      variantJobs(s, projectId, [variantId]).find(
        (j) => j.kind === null || j.kind === 'layout_proposal',
      )?.jobId ?? null,
  )
  const failure = useStore(runs.store, (s) => s.failures[keyOf(target)] ?? null)

  async function confirm(provider: string): Promise<Result<unknown>> {
    const reply = await command('generation.proposeLayout', { ...target, provider })
    if (!reply.ok) return reply
    const id = (reply.data as { jobId: string }).jobId
    const label = providers?.find((p) => p.id === provider)?.label ?? provider
    runs.start(id, { ...target, label })
    attached.getState().register(id, target, () => void applyLayout(api, target, id))
    setOpen(false)
    return reply
  }

  function stop(id: string) {
    void command('job.cancel', { projectId, jobId: id })
    attached.getState().end(id)
  }

  let line: LayoutBannerLine | null = null
  if (jobId !== null) line = { kind: 'running', onStop: () => stop(jobId) }
  else if (failure !== null) {
    line = { kind: 'failed', words: failure, onDismiss: () => runs.fail(target, null) }
  }

  return {
    canPlace: canPlaceText(layers),
    running: jobId !== null,
    onPlace: () => setOpen(true),
    dialog: { open, onConfirm: confirm, onCancel: () => setOpen(false) },
    line,
  }
}
