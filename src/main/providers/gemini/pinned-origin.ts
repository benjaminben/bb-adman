// SPEC 6 [1.12], 6.2 O-1: Gemini requests may go only to this origin. Every request goes
// through `pinnedFetch`, which refuses any other origin before anything is sent. An error
// thrown by the network call itself is marked, and only a marked error can become `offline`.
// [1.14] G8: the whole answer body is read inside the marked step and the library gets a
// finished answer, so a connection that breaks during the read is marked too.
// [1.20] L1: the body read stops at a byte limit (Section 6, F-01).
import { MAX_PROVIDER_ANSWER_BYTES } from '@/main/providers/picture-limits'
import { ProviderFailure } from '@/main/providers/types'

export const GEMINI_ORIGIN = 'https://generativelanguage.googleapis.com'

export class NetworkError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause })
    this.name = 'NetworkError'
  }
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError
}

function addressOf(input: RequestInfo | URL): string {
  if (input instanceof Request) return input.url
  return String(input)
}

function originOf(address: string): string | undefined {
  try {
    return new URL(address).origin
  } catch {
    return undefined
  }
}

// An answer over the limit is `other`, never `offline`: the network did not fail.
function tooLarge(): ProviderFailure {
  return new ProviderFailure({ kind: 'other', detail: 'Answer too large' })
}

// Refuses at once, reading nothing, when content-length is over the limit. Otherwise counts
// the bytes handed to the app and cancels the read once the count passes the limit.
// For an answer with no body stream to count.
function checkedWhole(body: ArrayBuffer, limit: number): ArrayBuffer {
  if (body.byteLength > limit) throw tooLarge()
  return body
}

async function readLimited(response: Response, limit: number): Promise<ArrayBuffer> {
  if (Number(response.headers.get('content-length')) > limit) {
    await response.body?.cancel().catch(() => undefined)
    throw tooLarge()
  }
  if (!response.body) return checkedWhole(await response.arrayBuffer(), limit)
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let count = 0
  for (let part = await reader.read(); !part.done; part = await reader.read()) {
    count += part.value.byteLength
    if (count > limit) {
      await reader.cancel().catch(() => undefined)
      throw tooLarge()
    }
    chunks.push(part.value)
  }
  const whole = new Uint8Array(count)
  let at = 0
  for (const chunk of chunks) {
    whole.set(chunk, at)
    at += chunk.byteLength
  }
  return whole.buffer
}

export function pinnedFetch(
  inner: typeof fetch,
  limit: number = MAX_PROVIDER_ANSWER_BYTES,
): typeof fetch {
  return async (input, init) => {
    const origin = originOf(addressOf(input))
    if (origin !== GEMINI_ORIGIN) {
      throw new ProviderFailure({
        kind: 'other',
        detail: `Request refused: ${origin ?? 'an unreadable address'} is not the Gemini host`,
      })
    }
    // [1.16] H19: only the network call and the body read are marked; building the
    // finished answer is not, so an error there stays `other`.
    let response: Response
    let body: ArrayBuffer | null
    try {
      response = await inner(input, init)
      body = NO_BODY.has(response.status) ? null : await readLimited(response, limit)
    } catch (error) {
      if (error instanceof ProviderFailure) throw error
      throw new NetworkError(error)
    }
    const { status, statusText, headers } = response
    return new Response(body, { status, statusText, headers })
  }
}

// Statuses whose Response may not carry a body.
const NO_BODY = new Set([204, 205, 304])
