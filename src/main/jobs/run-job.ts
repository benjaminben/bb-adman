// Runs one job (SPEC 3.6 "Jobs", 6.11): marks it running, hands the kind handler its run
// context, and writes the end. The raw provider detail goes into error_detail only: never
// into job.updated, a log line or a reply (SPEC 3.3 [1.9]).
import { emitJob, nowText, writeJob, type LiveJob, type RunnerState } from './live'
import { addPaidCall, readJob, type JobChange } from './job-store'
import type { JobRunContext } from './types'
import { setReporter } from './progress'
import { errorContext } from '../log/error-context'
import { ProviderCancelled, ProviderFailure } from '../providers/types'
import { AppError } from '../../shared/schemas/result'
import type { JobRow } from '../../shared/schemas/rows/job'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function succeeded(live: LiveJob, value: unknown): JobChange {
  if (!live.cancelAsked) return { status: 'succeeded', result: value ?? null }
  const result = isRecord(value) ? { ...value } : { value: value ?? null }
  return { status: 'succeeded', result: { ...result, finishedAfterCancel: true } }
}

function failed(state: RunnerState, live: LiveJob, e: unknown): JobChange {
  if (e instanceof ProviderCancelled) return { status: 'cancelled', result: null }
  if (e instanceof ProviderFailure) {
    const { kind, reason, detail, missing } = e.error
    return {
      status: 'failed',
      errorKind: kind,
      errorReason: reason ?? null,
      errorDetail: detail,
      result: missing ? { missing } : null,
    }
  }
  if (!(e instanceof AppError)) {
    state.opts.deps().log.write({
      level: 'error',
      event: 'job',
      name: live.kind,
      actor: 'system',
      projectId: live.projectId,
      jobId: live.id,
      ok: false,
      errorKind: 'other',
      message: 'A job stopped on an unforeseen error.',
      context: { error: errorContext(e) },
    })
  }
  const detail = e instanceof AppError ? e.code : 'internal'
  return {
    status: 'failed',
    errorKind: 'other',
    errorReason: null,
    errorDetail: detail,
    result: null,
  }
}

function logEnd(state: RunnerState, live: LiveJob, change: JobChange): void {
  state.opts.deps().log.write({
    level: change.status === 'failed' ? 'warn' : 'info',
    event: 'job',
    name: live.kind,
    actor: 'system',
    projectId: live.projectId,
    jobId: live.id,
    ok: change.status === 'succeeded',
    errorKind: change.errorKind ?? null,
    message: `Job ${change.status ?? 'ended'}`,
    context: { provider: live.providerId, reason: change.errorReason ?? null },
  })
}

function context(state: RunnerState, live: LiveJob): JobRunContext {
  const deps = state.opts.deps()
  const jc: JobRunContext = {
    deps,
    projectId: live.projectId,
    signal: live.controller.signal,
    async call(fn) {
      // Nothing new is sent once cancel was asked for (SPEC 6.11.2).
      if (live.ended || live.cancelAsked) throw new ProviderCancelled()
      const handle = deps.projects.get(live.projectId)
      // SPEC 6.11.1: counted at the moment of sending, unless the provider is local.
      if (handle && live.provider?.local !== true) {
        addPaidCall(handle, live.id, nowText(state))
        emitJob(state, live.projectId, live.id)
      }
      return fn()
    },
    progress(fraction) {
      if (!live.ended) writeJob(state, live.projectId, live.id, { progress: fraction })
    },
    cancelled: () => live.ended,
    async system(command, input) {
      if (live.ended) throw new Error('The job has ended')
      return state.opts.bus().execute(command, input, { actor: 'user' })
    },
  }
  setReporter(jc, (p) => {
    if (live.ended) return
    const { cancelAsked } = live.running
    live.running = {
      stage: p.stage,
      ...(p.queuePosition === undefined ? {} : { queuePosition: p.queuePosition }),
    }
    if (cancelAsked) live.running.cancelAsked = cancelAsked
    const change: JobChange = { result: live.running }
    if (p.fraction !== undefined) change.progress = p.fraction
    writeJob(state, live.projectId, live.id, change)
  })
  return jc
}

export function startJob(state: RunnerState, projectId: string, row: JobRow): void {
  const deps = state.opts.deps()
  const providerId = row.provider ?? ''
  const live: LiveJob = {
    id: row.id,
    projectId,
    kind: row.kind,
    providerId,
    provider: deps.providers.find((p) => p.id === providerId),
    controller: new AbortController(),
    ended: false,
    cancelAsked: false,
    running: {},
    clearWait: () => undefined,
    finish(change) {
      if (live.ended) return
      live.ended = true
      live.clearWait()
      state.active.delete(live.id)
      writeJob(state, projectId, live.id, change)
      logEnd(state, live, change)
      state.pump()
    },
  }
  state.active.set(row.id, live)
  writeJob(state, projectId, row.id, { status: 'running' })
  const handler = state.opts.handlers.find((h) => h.kind === row.kind)
  const handle = deps.projects.get(projectId)
  const current = (handle && readJob(handle, row.id)) ?? row
  const work = handler
    ? Promise.resolve().then(() => handler.run(context(state, live), current))
    : Promise.reject(new Error(`No handler for job kind ${row.kind}`))
  work.then(
    (value) => live.finish(succeeded(live, value)),
    (e: unknown) => live.finish(failed(state, live, e)),
  )
}
