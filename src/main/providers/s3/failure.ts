// SPEC 6, 6.5: every S3 failure becomes one ProviderFailure with an error kind.
// A rejected key or missing permission → bad_key; SlowDown or 429 → quota; RequestTimeout or a
// timed-out request → timeout; a marked network error → offline (SPEC 6 [1.12]); anything
// else, including a build error → other. Neither key ever appears in `detail`: every
// ProviderFailure the adapter lets out, a passed-on one included, goes through the shared
// redactSecret (SPEC 6 [1.12], 6.5 [1.14] H4).
import { S3ServiceException } from '@aws-sdk/client-s3'
import { redactSecret } from '@/main/providers/redact'
import { ProviderFailure, type ProviderError } from '@/main/providers/types'
import { isNetworkError } from './pinned-host'

const BAD_KEY_CODES = new Set([
  'InvalidAccessKeyId',
  'SignatureDoesNotMatch',
  'AccessDenied',
  'ExpiredToken',
  'InvalidToken',
])
const QUOTA_CODES = new Set(['SlowDown', 'TooManyRequests'])
const TIMEOUT_CODES = new Set(['RequestTimeout'])
const NETWORK_TIMEOUT_CODES = new Set(['TimeoutError', 'ETIMEDOUT'])

export function kindForCode(code: string, status?: number): ProviderError['kind'] {
  if (BAD_KEY_CODES.has(code) || status === 401 || status === 403) return 'bad_key'
  if (QUOTA_CODES.has(code) || status === 429) return 'quota'
  if (TIMEOUT_CODES.has(code)) return 'timeout'
  return 'other'
}

function removeKeys(text: string, keys: string[]): string {
  return keys.reduce((safe, key) => redactSecret(safe, key), text)
}

export function s3Failure(kind: ProviderError['kind'], detail: string, keys: string[]) {
  return new ProviderFailure({ kind, detail: removeKeys(detail, keys) })
}

// A thrown error from the S3 client, lib-storage or the network below them.
export function failureFromS3Error(error: unknown, keys: string[]): ProviderFailure {
  if (error instanceof ProviderFailure) {
    const detail = removeKeys(error.error.detail, keys)
    return detail === error.error.detail ? error : s3Failure(error.error.kind, detail, keys)
  }
  if (error instanceof S3ServiceException) {
    const status = error.$metadata.httpStatusCode
    const detail = `HTTP ${status ?? '?'} ${error.name}: ${error.message}`
    return s3Failure(kindForCode(error.name, status), detail, keys)
  }
  if (isNetworkError(error)) {
    const kind = NETWORK_TIMEOUT_CODES.has(error.code) ? 'timeout' : 'offline'
    return s3Failure(kind, `${error.code}: ${error.message}`, keys)
  }
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code ?? error.name
    return s3Failure(kindForCode(code), `${code}: ${error.message}`, keys)
  }
  return s3Failure('other', String(error), keys)
}
