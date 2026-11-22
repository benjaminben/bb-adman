// The one way the app reaches Dropbox (spec/phases/phase-09.md "Dropbox hosts and calls",
// security class full). Every address is checked before anything is sent: a plain string or URL,
// https only, no user part, no port but 443, no query string, and the host exactly one of the two
// API hosts. A token therefore only ever goes to those hosts. Redirects are an error and are never
// followed (Node's fetch would keep the Authorization header on a redirect to another host), and
// a redirect answer from an inner fetch that ignored that is refused too. No credentials are
// taken from the environment. Only the network call is marked here; answer.ts marks the body
// read. The mark carries no words from the cause.
import { ProviderFailure } from '@/main/providers/types'
import { DROPBOX_HOSTS } from './hosts'

export const NOT_DROPBOX = 'Request refused: the address is not a Dropbox API host'
export const REDIRECT_REFUSED = 'Request refused: Dropbox answered with a redirect'

export class DropboxNetworkError extends Error {
  readonly timedOut: boolean
  constructor(cause: unknown) {
    const timedOut = cause instanceof Error && cause.name === 'TimeoutError'
    super(timedOut ? 'Dropbox did not answer in time' : 'Could not reach Dropbox', { cause })
    this.name = 'DropboxNetworkError'
    this.timedOut = timedOut
  }
}

export function isDropboxNetworkError(error: unknown): error is DropboxNetworkError {
  return error instanceof DropboxNetworkError
}

const refused = (detail: string) => new ProviderFailure({ kind: 'other', detail })

function pinnedAddress(input: RequestInfo | URL): string | null {
  if (typeof input !== 'string' && !(input instanceof URL)) return null
  let url: URL
  try {
    url = new URL(input)
  } catch {
    return null
  }
  const plain = !url.username && !url.password && !url.port && !url.search && !url.hash
  if (url.protocol !== 'https:' || !plain || !DROPBOX_HOSTS.includes(url.hostname)) return null
  return url.href
}

function isRedirect(response: Response): boolean {
  return response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)
}

// Node's fetch rejects a redirect under `redirect: 'error'` with this cause. Were its words to
// change, the redirect would still not be followed; it would only be reported as `offline`.
function isRefusedRedirect(error: unknown): boolean {
  const cause = error instanceof Error ? error.cause : undefined
  return cause instanceof Error && cause.message === 'unexpected redirect'
}

export function pinnedFetch(inner: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const address = pinnedAddress(input)
    if (!address) throw refused(NOT_DROPBOX)
    let response: Response
    try {
      response = await inner(address, { ...init, redirect: 'error', credentials: 'omit' })
    } catch (error) {
      if (isRefusedRedirect(error)) throw refused(REDIRECT_REFUSED)
      throw new DropboxNetworkError(error)
    }
    if (isRedirect(response)) {
      await response.body?.cancel().catch(() => undefined)
      throw refused(REDIRECT_REFUSED)
    }
    return response
  }
}
