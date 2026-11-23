// SPEC 6.11.1 [1.38] "keep and the final result": the one place that builds a job's result,
// while it runs and when it ends. Every end of a job goes through endChange.
//   running     what was kept, plus stage, queuePosition, cancelAsked
//   succeeded   what the handler returned, plus finishedAfterCancel when a stop was asked
//   otherwise   what was kept, plus cancelAsked, outcomeUnknown, stoppedWaiting, missing,
//               missingCount; null when that is empty
// The runner's field names win over a kept value that uses one of them.
import type { JobChange } from './job-store'
import type { LiveJob } from './live'
import type { ProviderErrorKind, ProviderErrorReason } from '@/shared/schemas/queries/app'

const RUNNER_FIELDS = new Set([
  'stage',
  'queuePosition',
  'cancelAsked',
  'outcomeUnknown',
  'stoppedWaiting',
  'missing',
  'missingCount',
  'finishedAfterCancel',
])

export type JobEnd =
  | { status: 'succeeded'; value: unknown }
  | { status: 'cancelled'; outcomeUnknown?: true; stoppedWaiting?: true }
  | {
      status: 'failed'
      errorKind: ProviderErrorKind
      errorReason: ProviderErrorReason | null
      errorDetail: string
      missing?: unknown[]
      missingCount?: number
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function keptOf(live: LiveJob): Record<string, unknown> {
  return Object.fromEntries(Object.entries(live.kept).filter(([k]) => !RUNNER_FIELDS.has(k)))
}

export function runningResult(live: LiveJob): Record<string, unknown> {
  return { ...keptOf(live), ...live.shown, ...(live.cancelAsked ? { cancelAsked: true } : {}) }
}

function succeededResult(live: LiveJob, value: unknown): unknown {
  if (!live.cancelAsked) return value ?? null
  const result = isRecord(value) ? { ...value } : { value: value ?? null }
  return { ...result, finishedAfterCancel: true }
}

export function endChange(live: LiveJob, end: JobEnd): JobChange {
  if (end.status === 'succeeded') {
    return { status: 'succeeded', result: succeededResult(live, end.value) }
  }
  const fields: Record<string, unknown> = {}
  if (live.cancelAsked) fields.cancelAsked = true
  if (end.status === 'cancelled') {
    if (end.outcomeUnknown) fields.outcomeUnknown = true
    if (end.stoppedWaiting) fields.stoppedWaiting = true
  } else {
    if (end.missing) fields.missing = end.missing
    if (end.missingCount !== undefined) fields.missingCount = end.missingCount
  }
  const kept = { ...keptOf(live), ...fields }
  const result = Object.keys(kept).length > 0 ? kept : null
  if (end.status === 'cancelled') return { status: 'cancelled', result }
  const { errorKind, errorReason, errorDetail } = end
  return { status: 'failed', errorKind, errorReason, errorDetail, result }
}
