// P4-6, spec/providers.md "Failures": every Firefly failure becomes one ProviderFailure with an
// error kind. 401/403, or a refused client at sign-in → bad_key; 429 → quota; 408 or our own
// timer → timeout; 451 or a documented unsafe-content code → refused; a network error marked
// by the fetch wrapper → offline; anything else → other. Every detail has each secret read
// (client ID, client secret, access token) removed.
import { redactSecret } from '@/main/providers/redact'
import { ProviderFailure, type ProviderError } from '@/main/providers/types'
import { isNetworkError } from './pinned-origin'

type Kind = ProviderError['kind']

// The error codes in Adobe's published Firefly OpenAPI file that mean the content rules
// stopped the request.
const REFUSED_CODES = new Set(['prompt_unsafe', 'input_media_unsafe', 'output_media_unsafe'])

// Adobe sign-in codes that mean the client ID or secret was not accepted.
const BAD_CLIENT_CODES = new Set(['invalid_client', 'unauthorized_client'])

// The longest part of an answer kept in a detail.
const DETAIL_CHARS = 500

export function fail(kind: Kind, detail: string, secrets: string[]): ProviderFailure {
  const safe = secrets.reduce((text, secret) => redactSecret(text, secret), detail)
  return new ProviderFailure({ kind, detail: safe })
}

// The `error_code` of a Firefly answer or the `error` of a sign-in answer, if any.
function codeIn(text: string): string | undefined {
  try {
    const body = JSON.parse(text) as { error_code?: unknown; error?: unknown }
    const code = body.error_code ?? body.error
    return typeof code === 'string' ? code : undefined
  } catch {
    return undefined
  }
}

export function kindForCode(code: string | undefined): Kind {
  if (code !== undefined && REFUSED_CODES.has(code)) return 'refused'
  if (code !== undefined && BAD_CLIENT_CODES.has(code)) return 'bad_key'
  return 'other'
}

function kindForAnswer(status: number, code: string | undefined): Kind {
  if (status === 401 || status === 403) return 'bad_key'
  if (status === 429) return 'quota'
  if (status === 408) return 'timeout'
  if (status === 451) return 'refused'
  return kindForCode(code)
}

// A finished answer whose status is not a success. Secrets are removed from the whole text
// before it is cut, so a secret that crosses the cut point cannot survive in part.
export function failureFromAnswer(
  status: number,
  text: string,
  secrets: string[],
): ProviderFailure {
  const safe = secrets.reduce((all, secret) => redactSecret(all, secret), text)
  const detail = `HTTP ${status}: ${safe.slice(0, DETAIL_CHARS)}`
  return fail(kindForAnswer(status, codeIn(text)), detail, secrets)
}

// A thrown error. `timedOut` is true when our own timer fired.
export function failureFromError(
  error: unknown,
  timedOut: boolean,
  secrets: string[],
): ProviderFailure {
  if (error instanceof ProviderFailure) {
    return fail(error.error.kind, error.error.detail, secrets)
  }
  if (timedOut) return fail('timeout', 'No answer within the time limit', secrets)
  if (isNetworkError(error)) return fail('offline', error.message, secrets)
  return fail('other', error instanceof Error ? error.message : String(error), secrets)
}
