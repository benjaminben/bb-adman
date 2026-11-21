// P4-6, spec/providers.md "Rules for every adapter": Firefly requests may go only to these
// hosts, each request to the one host its step needs. Every request goes through
// `pinnedFetch(host, ...)`, which refuses any other origin before anything is sent, so the
// sign-in host and the Firefly API host each refuse the other.
// The picture host is where the documented answer's picture address points (a pre-signed
// address, sent no credentials). The whole answer body is read inside the marked step and
// stops at a byte limit; no redirect is followed. Same rules as the Gemini wrapper.
import { MAX_PROVIDER_ANSWER_BYTES } from '@/main/providers/picture-limits'
import { ProviderFailure } from '@/main/providers/types'

export const FIREFLY_TOKEN_ORIGIN = 'https://ims-na1.adobelogin.com'
export const FIREFLY_API_ORIGIN = 'https://firefly-api.adobe.io'
export const FIREFLY_PICTURE_ORIGIN = 'https://pre-signed-firefly-prod.s3-accelerate.amazonaws.com'

export type FireflyHost = 'token' | 'api' | 'picture'

const ORIGINS: Record<FireflyHost, string> = {
  token: FIREFLY_TOKEN_ORIGIN,
  api: FIREFLY_API_ORIGIN,
  picture: FIREFLY_PICTURE_ORIGIN,
}

const NAMES: Record<FireflyHost, string> = {
  token: 'Adobe sign-in',
  api: 'Firefly API',
  picture: 'Firefly picture',
}

// On a redirect to another origin Node's fetch keeps custom headers such as x-api-key and
// Authorization, so a credential could reach the new host.
export const REDIRECT_REFUSED = 'Request refused: the Firefly host answered with a redirect'

export class NetworkError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause })
    this.name = 'NetworkError'
  }
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError
}

function originOf(input: RequestInfo | URL): string | undefined {
  try {
    return new URL(input instanceof Request ? input.url : String(input)).origin
  } catch {
    return undefined
  }
}

function isRedirect(response: Response): boolean {
  return response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)
}

// An answer over the limit is `other`, never `offline`: the network did not fail.
function tooLarge(): ProviderFailure {
  return new ProviderFailure({ kind: 'other', detail: 'Answer too large' })
}

// Refuses at once when content-length is over the limit; otherwise counts the bytes handed to
// the app and cancels the read once the count passes the limit.
async function readLimited(response: Response, limit: number): Promise<ArrayBuffer> {
  if (Number(response.headers.get('content-length')) > limit) {
    await response.body?.cancel().catch(() => undefined)
    throw tooLarge()
  }
  if (!response.body) {
    const whole = await response.arrayBuffer()
    if (whole.byteLength > limit) throw tooLarge()
    return whole
  }
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

// Statuses whose Response may not carry a body.
const NO_BODY = new Set([204, 205])

export function pinnedFetch(
  host: FireflyHost,
  inner: typeof fetch,
  limit: number = MAX_PROVIDER_ANSWER_BYTES,
): typeof fetch {
  return async (input, init) => {
    const origin = originOf(input)
    if (origin !== ORIGINS[host]) {
      throw new ProviderFailure({
        kind: 'other',
        detail: `Request refused: ${origin ?? 'an unreadable address'} is not the ${NAMES[host]} host`,
      })
    }
    let response: Response
    let body: ArrayBuffer | null
    try {
      response = await inner(input, { ...init, redirect: 'manual' })
      if (isRedirect(response)) {
        await response.body?.cancel().catch(() => undefined)
        throw new ProviderFailure({ kind: 'other', detail: REDIRECT_REFUSED })
      }
      body = NO_BODY.has(response.status) ? null : await readLimited(response, limit)
    } catch (error) {
      if (error instanceof ProviderFailure) throw error
      throw new NetworkError(error)
    }
    const { status, statusText, headers } = response
    return new Response(body, { status, statusText, headers })
  }
}
