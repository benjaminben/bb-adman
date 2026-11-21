// spec/providers-adapters.md fal error mapping: 401/403 bad_key, 429 quota, content rules
// refused, our own timer timeout, a marked network error offline, the rest other. No raw text
// from an answer or an error reaches a detail: details are fixed sentences, plus fal's error
// type when it is a plain lower-case word. Every detail goes through redactSecret.
import { redactSecret } from '@/main/providers/redact'
import { ProviderFailure, type ProviderError } from '@/main/providers/types'
import { FalNetworkError, type FalAnswer } from './fal-fetch'

const SAFE_TYPE = /^[a-z_]{1,64}$/
const REFUSED_TYPES = new Set(['content_policy_violation'])

function fail(kind: ProviderError['kind'], detail: string, key: string): ProviderFailure {
  return new ProviderFailure({ kind, detail: redactSecret(detail, key) })
}

const withType = (text: string, type: string | undefined) => (type ? `${text} (${type})` : text)

// fal's error types in an error answer: `detail[].type` or `error_type`, plain words only.
function errorTypes(bytes: Uint8Array): string[] {
  let body: unknown
  try {
    body = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return []
  }
  if (typeof body !== 'object' || body === null) return []
  const { detail, error_type } = body as { detail?: unknown; error_type?: unknown }
  const found = [error_type]
  if (Array.isArray(detail)) {
    for (const item of detail) found.push((item as { type?: unknown } | null)?.type)
  }
  return found.filter((t): t is string => typeof t === 'string' && SAFE_TYPE.test(t))
}

export function falHttpFailure(answer: FalAnswer, key: string): ProviderFailure {
  const types = errorTypes(answer.bytes)
  const { status } = answer
  const refused = types.find((t) => REFUSED_TYPES.has(t))
  let kind: ProviderError['kind'] = 'other'
  if (status === 401 || status === 403) kind = 'bad_key'
  else if (status === 429) kind = 'quota'
  else if (refused) kind = 'refused'
  return fail(kind, withType(`HTTP ${status}`, refused ?? types[0]), key)
}

// A run fal reports COMPLETED with an error.
export function falRunFailure(errorType: string | null | undefined, key: string): ProviderFailure {
  const type = errorType && SAFE_TYPE.test(errorType) ? errorType : undefined
  const kind = type && REFUSED_TYPES.has(type) ? 'refused' : 'other'
  return fail(kind, withType('The run failed', type), key)
}

// A thrown error. `timedOut` is true when our own timer fired.
export function falThrownFailure(error: unknown, timedOut: boolean, key: string): ProviderFailure {
  if (timedOut) return fail('timeout', 'No answer within the time limit', key)
  if (error instanceof ProviderFailure) {
    return new ProviderFailure({ ...error.error, detail: redactSecret(error.error.detail, key) })
  }
  if (error instanceof FalNetworkError) return fail('offline', error.message, key)
  return fail('other', 'The fal.ai call failed', key)
}
