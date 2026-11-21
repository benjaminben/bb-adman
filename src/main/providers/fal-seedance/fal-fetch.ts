// phase-07 "fal.ai Seedance" (A-170, security class): the one way the fal adapter reaches the
// network. Every address is checked before anything is sent: https only, no port, no user
// part, the queue origin or a media host and nothing else. The key goes to the queue origin
// only; a media host gets a bare GET with no header. No redirect is followed (Node's fetch
// would keep the Authorization header on a redirect to another host). Answers are read under
// MAX_PROVIDER_ANSWER_BYTES (JSON) or MAX_VIDEO_BYTES (the download). Only the network call
// and the body read are marked as network errors, and the mark carries no raw text.
import { MAX_PROVIDER_ANSWER_BYTES, MAX_VIDEO_BYTES } from '@/main/providers/picture-limits'
import { readLimited } from '@/main/providers/read-limited'
import { ProviderFailure } from '@/main/providers/types'
import { FAL_MEDIA_HOST, FAL_QUEUE_ORIGIN } from './origins'

export type FalAnswer = { status: number; bytes: Uint8Array }
export type FalRequest = { method: 'GET' | 'POST' | 'PUT'; body?: unknown; signal?: AbortSignal }

export const REDIRECT_REFUSED = 'Request refused: fal.ai answered with a redirect'
export const NOT_FAL = 'Request refused: the address is not a fal.ai host'
const MEDIA_GET_ONLY = 'Request refused: a fal.ai media host is only read'

export class FalNetworkError extends Error {
  constructor(cause: unknown) {
    super('Could not reach fal.ai', { cause })
    this.name = 'FalNetworkError'
  }
}

type Place = 'queue' | 'media'

function placeOf(address: string): { url: URL; place: Place } | null {
  let url: URL
  try {
    url = new URL(address)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
  if (url.origin === FAL_QUEUE_ORIGIN) return { url, place: 'queue' }
  if (FAL_MEDIA_HOST.test(url.hostname)) return { url, place: 'media' }
  return null
}

const refused = (detail: string) => new ProviderFailure({ kind: 'other', detail })

function isRedirect(response: Response): boolean {
  return response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)
}

function headersFor(place: Place, key: string, hasBody: boolean): Headers {
  const headers = new Headers()
  if (place === 'media') return headers
  headers.set('authorization', `Key ${key}`)
  headers.set('accept', 'application/json')
  if (hasBody) headers.set('content-type', 'application/json')
  return headers
}

export function pinnedFal(inner: typeof fetch, key: string) {
  async function send(address: string, request: FalRequest): Promise<FalAnswer> {
    const target = placeOf(address)
    if (!target) throw refused(NOT_FAL)
    const { url, place } = target
    const hasBody = request.body !== undefined
    if (place === 'media' && (request.method !== 'GET' || hasBody)) throw refused(MEDIA_GET_ONLY)
    const init: RequestInit = {
      method: request.method,
      headers: headersFor(place, key, hasBody),
      redirect: 'manual',
      ...(hasBody && { body: JSON.stringify(request.body) }),
      ...(request.signal && { signal: request.signal }),
    }
    const limit = place === 'queue' ? MAX_PROVIDER_ANSWER_BYTES : MAX_VIDEO_BYTES
    try {
      const response = await inner(url.href, init)
      if (isRedirect(response)) {
        await response.body?.cancel().catch(() => undefined)
        throw refused(REDIRECT_REFUSED)
      }
      const bytes = new Uint8Array(await readLimited(response, limit))
      return { status: response.status, bytes }
    } catch (error) {
      if (error instanceof ProviderFailure) throw error
      // Our own timer stopped the call: the caller turns that into `timeout`.
      if (request.signal?.aborted) throw error
      throw new FalNetworkError(error)
    }
  }

  // The finished video: a media host only, whatever the answer named.
  async function download(address: string, signal?: AbortSignal): Promise<FalAnswer> {
    if (placeOf(address)?.place !== 'media') throw refused(NOT_FAL)
    return send(address, { method: 'GET', ...(signal && { signal }) })
  }

  return { send, download }
}

export type FalSend = ReturnType<typeof pinnedFal>
