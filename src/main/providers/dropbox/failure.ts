// Every Dropbox failure becomes one ProviderFailure with an error kind (spec/phases/phase-09.md
// "Dropbox hosts and calls"). The detail is the status and the error's `.tag` chain only, for
// example `409 path/insufficient_space`: never `error_summary` or `user_message`, which can hold
// a path, and never any other words from an answer or an error. Each tag must be a plain
// lower-case word. Every detail goes through redactSecret for each token the call held and is
// cut to 200 characters after that.
import { redactSecret } from '@/main/providers/redact'
import { ProviderFailure, type ProviderError } from '@/main/providers/types'
import { isDropboxNetworkError } from './pinned-fetch'

// 'token' is a POST to /oauth2/token, whose errors are OAuth's: `{ error: "invalid_grant" }`.
export type DropboxCall = 'token' | 'api'

const SAFE_TAG = /^[a-z0-9_]{1,64}$/
const MAX_TAGS = 8
const MAX_DETAIL = 200
const BAD_KEY_TAGS = new Set(['invalid_access_token', 'expired_access_token', 'missing_scope'])
const QUOTA_TAGS = new Set(['too_many_requests', 'too_many_write_operations'])

function parsed(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

// The `.tag` chain of `error`: each level's tag, then the level under that tag (or under
// `reason`, where Dropbox puts a rate-limit tag). OAuth's string `error` is a chain of one.
export function errorTags(bytes: Uint8Array): string[] {
  const body = parsed(bytes)
  if (!isObject(body)) return []
  const tags: string[] = []
  let at: unknown = body.error
  if (typeof at === 'string') return SAFE_TAG.test(at) ? [at] : []
  while (isObject(at) && tags.length < MAX_TAGS) {
    const tag = at['.tag']
    if (typeof tag === 'string') {
      if (!SAFE_TAG.test(tag)) break
      tags.push(tag)
      at = at[tag]
    } else {
      at = at.reason
    }
  }
  return tags
}

function fail(error: ProviderError, secrets: string[]): ProviderFailure {
  const safe = secrets.reduce((text, secret) => redactSecret(text, secret), error.detail)
  return new ProviderFailure({ ...error, detail: safe.slice(0, MAX_DETAIL) })
}

function kindFor(status: number, tags: string[]): ProviderError['kind'] {
  if (status === 401 || status === 403 || tags.some((t) => BAD_KEY_TAGS.has(t))) return 'bad_key'
  if (status === 429 || status === 503 || tags.some((t) => QUOTA_TAGS.has(t))) return 'quota'
  return 'other'
}

// An answer that is not a success. `bytes` is the body, already read under the JSON limit.
export function answerFailure(
  status: number,
  bytes: Uint8Array,
  secrets: string[],
  call: DropboxCall = 'api',
): ProviderFailure {
  const tags = errorTags(bytes)
  const detail = tags.length > 0 ? `${status} ${tags.join('/')}` : String(status)
  if (call === 'token' && tags[0] === 'invalid_grant') {
    return fail({ kind: 'bad_key', reason: 'dropbox_signed_out', detail }, secrets)
  }
  return fail({ kind: kindFor(status, tags), detail }, secrets)
}

// A thrown error: a refusal or failure already made, a marked network error, or anything else.
export function thrownFailure(error: unknown, secrets: string[]): ProviderFailure {
  if (error instanceof ProviderFailure) return fail(error.error, secrets)
  if (isDropboxNetworkError(error)) {
    return fail({ kind: error.timedOut ? 'timeout' : 'offline', detail: error.message }, secrets)
  }
  return fail({ kind: 'other', detail: 'The Dropbox call failed' }, secrets)
}
