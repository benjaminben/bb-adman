// Runs one job (SPEC 3.6 "Jobs", 6.11): marks it running, hands the kind handler its run
// context, and writes the end. The raw provider detail goes into error_detail only: never
// into job.updated, a log line or a reply (SPEC 3.3 [1.9]).
import { emitJob, nowText, writeJob, type LiveJob, type RunnerState } from './live'
import { addPaidCall, readJob, type JobChange } from './job-store'
import { endChange, runningResult, type JobEnd } from './job-end'
import type { JobRunContext } from './types'
import { jobErrorContext } from './job-error-log'
import { agentRunAllowed } from '@/main/commands/agent-run-gate'
import { ProviderCancelled, ProviderFailure } from '@/main/providers/types'
import { AppError } from '@/shared/schemas/result'
import type { JobRow } from '@/shared/schemas/rows/job'

function failed(state: RunnerState, live: LiveJob, e: unknown): JobEnd {
  if (e instanceof ProviderCancelled) return { status: 'cancelled' }
  if (e instanceof ProviderFailure) {
    const { kind, reason, detail, missing } = e.error
    return {
      status: 'failed',
      errorKind: kind,
      errorReason: reason ?? null,
      errorDetail: detail,
      ...(missing ? { missing } : {}),
    }
  }
  if (!(e instanceof AppError)) {
    const deps = state.opts.deps()
    const names = live.provider?.secrets ?? []
    const secrets = names.flatMap((name) => deps.secrets.get(name) ?? [])
    const noMessage = live.provider === undefined || live.provider.serverText
    deps.log.write({
      level: 'error',
      event: 'job',
      name: live.kind,
      actor: 'system',
      projectId: live.projectId,
      jobId: live.id,
      ok: false,
      errorKind: 'other',
      message: 'A job stopped on an unforeseen error.',
      context: { error: jobErrorContext(e, secrets, noMessage) },
    })
  }
  const detail = e instanceof AppError ? e.code : 'internal'
  return { status: 'failed', errorKind: 'other', errorReason: null, errorDetail: detail }
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

function writeRunning(state: RunnerState, live: LiveJob, change: JobChange = {}): void {
  writeJob(state, live.projectId, live.id, { ...change, result: runningResult(live) })
}

function context(state: RunnerState, live: LiveJob): JobRunContext {
  const deps = state.opts.deps()
  const jc: JobRunContext = {
    deps,
    projectId: live.projectId,
    signal: live.controller.signal,
    async call(fn) {
      // Nothing new is sent once cancel was asked for (SPEC 6.11.2).
      // [1.38] Nor once the project is closed: the call would go out and not be counted.
      const handle = deps.projects.get(live.projectId)
      if (live.ended || live.cancelAsked || !handle) throw new ProviderCancelled()
      // AR-2: an agent's run not yet sent goes out only while its tick is on. Off, it ends
      // cancelled with no flag and nothing is sent. FIX-E: a picture job is checked before
      // every call; off after a send, no new call goes out and the calls in flight finish.
      const checked = !live.sent || live.kind === 'image_generation'
      if (live.startedBy === 'agent' && checked && !agentRunAllowed(deps, live.providerId)) {
        if (live.sent) {
          live.cancelAsked = true
          writeRunning(state, live)
          throw new ProviderCancelled()
        }
        live.finish({ status: 'cancelled' })
        live.controller.abort()
        throw new ProviderCancelled()
      }
      live.sent = true
      // SPEC 6.11.1: counted at the moment of sending, unless the provider is local.
      if (live.provider?.local !== true) {
        addPaidCall(handle, live.id, nowText(state))
        emitJob(state, live.projectId, live.id)
      }
      return fn()
    },
    progress(fraction) {
      if (!live.ended) writeJob(state, live.projectId, live.id, { progress: fraction })
    },
    // SPEC 6.11.1 [1.38]: true once a stop was asked for or the job has ended.
    cancelled: () => live.ended || live.cancelAsked,
    async system(command, input) {
      if (live.ended) throw new Error('The job has ended')
      return state.opts.bus().execute(command, input, { actor: 'user' })
    },
    setRemoteJobId(id) {
      live.sent = true
      if (!live.ended) writeJob(state, live.projectId, live.id, { remoteJobId: id })
    },
    keep(value) {
      if (live.ended) return
      live.kept = { ...value }
      writeRunning(state, live)
    },
    // A plain function, not a method: runOptions hands it to a provider on its own.
    onProgress: (p) => {
      if (live.ended) return
      live.shown = {
        stage: p.stage,
        ...(p.queuePosition === undefined ? {} : { queuePosition: p.queuePosition }),
      }
      writeRunning(state, live, p.fraction === undefined ? {} : { progress: p.fraction })
    },
  }
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
    startedBy: row.startedBy,
    // A job with a remote run ID was sent before (resumed at project open).
    sent: row.remoteJobId !== null,
    ended: false,
    cancelAsked: false,
    kept: {},
    shown: {},
    clearWait: () => undefined,
    finish(end) {
      if (live.ended) return
      live.ended = true
      live.clearWait()
      state.active.delete(live.id)
      const change = endChange(live, end)
      writeJob(state, projectId, live.id, change)
      logEnd(state, live, change)
      state.pump()
      for (const listener of [...state.onEnd]) listener()
    },
  }
  state.enqueued.delete(row.id)
  state.active.set(row.id, live)
  writeJob(state, projectId, row.id, { status: 'running' })
  const handler = state.opts.handlers.find((h) => h.kind === row.kind)
  const handle = deps.projects.get(projectId)
  const current = (handle && readJob(handle, row.id, deps.log)) ?? row
  const work = handler
    ? Promise.resolve().then(() => handler.run(context(state, live), current))
    : Promise.reject(new Error(`No handler for job kind ${row.kind}`))
  work.then(
    (value) => live.finish({ status: 'succeeded', value }),
    (e: unknown) => live.finish(failed(state, live, e)),
  )
}
