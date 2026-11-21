// How a request to the approvals service fails (spec/approvals.md "The service client",
// security class). Every failure is PROVIDER_ERROR with details { service: 'approvals', kind }
// and one of the fixed sentences: no text of the reply, the address or the key is ever in it.
// Each failure is logged once, as the route name, the kind and the HTTP status.
import { ErrorBody } from '@/shared/approvals/contract'
import { APPROVALS_FAILURE_MESSAGES, type ApprovalsFailureKind } from '@/shared/approvals/messages'
import type { ActivityLog } from '@/main/log/activity-log'
import { AppError } from '@/shared/schemas/result'

export type ApprovalsRoute =
  | 'health'
  | 'createLink'
  | 'getLink'
  | 'setPassword'
  | 'replaceGallery'
  | 'renewPictures'
  | 'deleteLink'

// INVALID_INPUT when a value the app would send fails the contract. Nothing is sent.
export const APPROVALS_REQUEST_REFUSED =
  'The app refused to send this request to the approvals service.'

export class ApprovalsFailure extends AppError {
  readonly kind: ApprovalsFailureKind
  // The HTTP status of the answer, 0 when there was none. Logged; never in the reply.
  readonly status: number

  constructor(kind: ApprovalsFailureKind | 'version', status = 0) {
    const sent = kind === 'version' ? 'other' : kind
    super('PROVIDER_ERROR', APPROVALS_FAILURE_MESSAGES[kind], { service: 'approvals', kind: sent })
    this.name = 'ApprovalsFailure'
    this.kind = sent
    this.status = status
  }
}

// The service's error code, when the body is its error shape; else null.
export function errorCodeOf(bytes: Buffer): string | null {
  try {
    const parsed = ErrorBody.safeParse(JSON.parse(bytes.toString('utf8')))
    return parsed.success ? parsed.data.error.code : null
  } catch {
    return null
  }
}

// An answer the route does not expect: 401 bad_key and 503 not_set_up have their own kind;
// every other one (3xx, 400, 5xx, a body of the wrong shape) is 'other'.
export function failureOf(status: number, bytes: Buffer): ApprovalsFailure {
  const code = errorCodeOf(bytes)
  if (status === 401 && code === 'bad_key') return new ApprovalsFailure('bad_key', status)
  if (status === 503 && code === 'not_set_up') return new ApprovalsFailure('not_set_up', status)
  return new ApprovalsFailure('other', status)
}

export function logFailure(log: ActivityLog, route: ApprovalsRoute, failure: ApprovalsFailure) {
  log.write({
    level: 'warn',
    event: 'provider',
    name: 'approvals.request',
    actor: 'system',
    ok: false,
    errorKind: failure.kind,
    message: 'A request to the approvals service failed.',
    context: { route, kind: failure.kind, status: failure.status },
  })
}
