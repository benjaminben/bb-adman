// SPEC 6, 6.5: every S3 failure becomes one ProviderFailure with an error kind.
// A rejected key or missing permission → bad_key; SlowDown or 429 → quota; RequestTimeout or a
// timed-out request → timeout; no connection → offline; anything else → other.
// Neither key ever appears in `detail`.
import { S3ServiceException } from '@aws-sdk/client-s3'
import { ProviderFailure, type ProviderError } from '../types'

const BAD_KEY_CODES = new Set([
  'InvalidAccessKeyId',
  'SignatureDoesNotMatch',
  'AccessDenied',
  'ExpiredToken',
  'InvalidToken',
])
const QUOTA_CODES = new Set(['SlowDown', 'TooManyRequests'])
const TIMEOUT_CODES = new Set(['RequestTimeout', 'TimeoutError'])
const OFFLINE_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ECONNRESET',
  'EAI_AGAIN',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'EPIPE',
])

export function kindForCode(code: string, status?: number): ProviderError['kind'] {
  if (BAD_KEY_CODES.has(code) || status === 401 || status === 403) return 'bad_key'
  if (QUOTA_CODES.has(code) || status === 429) return 'quota'
  if (TIMEOUT_CODES.has(code) || code === 'ETIMEDOUT') return 'timeout'
  if (OFFLINE_CODES.has(code)) return 'offline'
  return 'other'
}

export function s3Failure(kind: ProviderError['kind'], detail: string, keys: string[]) {
  let safe = detail
  for (const key of keys) if (key !== '') safe = safe.split(key).join('[key removed]')
  return new ProviderFailure({ kind, detail: safe })
}

// A thrown error from the S3 client, lib-storage or the network below them.
export function failureFromS3Error(error: unknown, keys: string[]): ProviderFailure {
  if (error instanceof ProviderFailure) return error
  if (error instanceof S3ServiceException) {
    const status = error.$metadata.httpStatusCode
    const detail = `HTTP ${status ?? '?'} ${error.name}: ${error.message}`
    return s3Failure(kindForCode(error.name, status), detail, keys)
  }
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code ?? error.name
    return s3Failure(kindForCode(code), `${code}: ${error.message}`, keys)
  }
  return s3Failure('other', String(error), keys)
}
