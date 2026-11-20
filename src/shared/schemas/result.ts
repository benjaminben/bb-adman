// SPEC 4.1 result format and error codes, shared by the window, the bus and MCP.
export const ERROR_CODES = [
  'INVALID_INPUT',
  'NOT_FOUND',
  'RULE_VIOLATION',
  'NEEDS_KEY',
  'PROVIDER_ERROR',
  'MISSING_FILE',
  'PROJECT_LOCKED',
  'AGENT_DENIED',
  'AGENT_REFUSED',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export type ErrorBody = {
  code: ErrorCode
  message: string
  details?: Record<string, unknown>
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: ErrorBody }

export class AppError extends Error {
  readonly code: ErrorCode
  readonly details?: Record<string, unknown>

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.details = details
  }

  toBody(): ErrorBody {
    return this.details
      ? { code: this.code, message: this.message, details: this.details }
      : { code: this.code, message: this.message }
  }
}

export function ok<T>(data: T): Result<T> {
  return { ok: true, data }
}

export function fail<T = never>(error: ErrorBody): Result<T> {
  return { ok: false, error }
}
