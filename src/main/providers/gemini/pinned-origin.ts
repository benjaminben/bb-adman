// SPEC 6 [1.12], 6.2 O-1: Gemini requests may go only to this origin. Every request goes
// through `pinnedFetch`, which refuses any other origin before anything is sent. An error
// thrown by the network call itself is marked, and only a marked error can become `offline`.
// [1.14] G8: the whole answer body is read inside the marked step and the library gets a
// finished answer, so a connection that breaks during the read is marked too.
import { ProviderFailure } from '../types'

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

export function pinnedFetch(inner: typeof fetch): typeof fetch {
  return async (input, init) => {
    const origin = originOf(addressOf(input))
    if (origin !== GEMINI_ORIGIN) {
      throw new ProviderFailure({
        kind: 'other',
        detail: `Request refused: ${origin ?? 'an unreadable address'} is not the Gemini host`,
      })
    }
    try {
      return await finished(await inner(input, init))
    } catch (error) {
      throw new NetworkError(error)
    }
  }
}

// Statuses whose Response may not carry a body.
const NO_BODY = new Set([204, 205, 304])

// The same answer with its body already read in full.
async function finished(response: Response): Promise<Response> {
  const body = NO_BODY.has(response.status) ? null : await response.arrayBuffer()
  const { status, statusText, headers } = response
  return new Response(body, { status, statusText, headers })
}
