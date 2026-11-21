// P4-5 (spec/ai-jobs.md "A plain sentence per failure cause", OI-68; security class): a job
// that fails after it was queued, for a reason that is not the provider's. LocalFailure
// carries a reason only. The reason is decided by comparing an AppError's `code` and
// `details.reason` with fixed values; nothing else of the error is read, so its path, code
// and message never reach the row, the sentence or a log line.
import { AppError } from '@/shared/schemas/result'
import type { ProviderErrorReason } from '@/shared/schemas/queries/app'

export type LocalReason = Extract<
  ProviderErrorReason,
  | 'key_missing'
  | 'picture_missing'
  | 'picture_too_large'
  | 'picture_changed'
  | 'assets_folder_missing'
  | 'assets_not_writable'
  | 'results_not_added'
  | 'target_gone'
>

export class LocalFailure extends Error {
  readonly reason: LocalReason

  constructor(reason: LocalReason) {
    super('A job failed for a local cause')
    this.name = 'LocalFailure'
    this.reason = reason
  }
}

const reasonIs = (e: AppError, value: string) => e.details?.reason === value

// AssetService.read's refusals (spec/assets.md "Reading a picture to send it").
export function readRefusalReason(e: unknown): LocalReason | null {
  if (!(e instanceof AppError)) return null
  if (e.code === 'MISSING_FILE' || e.code === 'NOT_FOUND') return 'picture_missing'
  if (e.code !== 'RULE_VIOLATION') return null
  if (reasonIs(e, 'asset_too_large')) return 'picture_too_large'
  if (reasonIs(e, 'asset_not_a_picture') || reasonIs(e, 'picture_not_usable')) {
    return 'picture_changed'
  }
  return null
}

// writeManaged: a refused assets folder, else any error is a file that could not be written.
export function writeFailureReason(e: unknown): LocalReason {
  const folder = e instanceof AppError && e.code === 'RULE_VIOLATION'
  return folder && reasonIs(e, 'assets_folder_missing')
    ? 'assets_folder_missing'
    : 'assets_not_writable'
}

// The runner's end for an AppError met after enqueue: NEEDS_KEY from the key guard inside the
// job is key_missing; any other gives no reason and the detail `app_error`.
export function appErrorEnd(e: AppError): { reason: LocalReason | null; detail: string } {
  if (e.code === 'NEEDS_KEY') return { reason: 'key_missing', detail: 'key_missing' }
  return { reason: null, detail: 'app_error' }
}

// A write error's own code (for example EACCES), when it has the shape of one. Never a path.
export function errnoCode(e: unknown): string | null {
  const code = (e as { code?: unknown } | null)?.code
  return typeof code === 'string' && /^E[A-Z0-9]{1,20}$/.test(code) ? code : null
}
