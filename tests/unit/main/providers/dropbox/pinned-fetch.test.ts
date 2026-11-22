import { describe, expect, it } from 'vitest'
import { failureOf } from '../../../../helpers/failure-of'
import { defaultDropboxFetch } from '@/main/providers/dropbox/fetch'
import {
  DROPBOX_API_HOST,
  DROPBOX_AUTHORIZE_URL,
  DROPBOX_CONTENT_HOST,
  DROPBOX_REDIRECT_URI,
} from '@/main/providers/dropbox/hosts'
import { DROPBOX_SIGN_IN_PORT } from '@/main/providers/dropbox/sign-in-port'
import { isDropboxNetworkError, pinnedFetch } from '@/main/providers/dropbox/pinned-fetch'

type Seen = { url: string; init: RequestInit | undefined }

function recorder(answer: () => Response | Promise<Response> = () => new Response('{}')) {
  const seen: Seen[] = []
  const inner: typeof fetch = async (input, init) => {
    seen.push({ url: String(input), init })
    return answer()
  }
  return { seen, inner }
}

describe('Dropbox hosts [P9-2, phase-09 "Dropbox hosts and calls"]', () => {
  it('names the two API hosts, the authorize address and the redirect address', () => {
    expect(DROPBOX_API_HOST).toBe('api.dropboxapi.com')
    expect(DROPBOX_CONTENT_HOST).toBe('content.dropboxapi.com')
    expect(DROPBOX_AUTHORIZE_URL).toBe('https://www.dropbox.com/oauth2/authorize')
    expect(DROPBOX_REDIRECT_URI).toBe(`http://127.0.0.1:${DROPBOX_SIGN_IN_PORT}/oauth/dropbox`)
  })
})

describe('pinnedFetch [P9-2]', () => {
  it.each([
    ['http:', 'http://api.dropboxapi.com/2/users/get_current_account'],
    ['another host', 'https://example.com/2/users/get_current_account'],
    ['a look-alike host', 'https://api.dropboxapi.com.example.com/oauth2/token'],
    ['the sign-in page host', 'https://www.dropbox.com/oauth2/token'],
    ['an IP address', 'https://162.125.1.1/oauth2/token'],
    ['a user name in the address', 'https://someone@api.dropboxapi.com/oauth2/token'],
    ['a password in the address', 'https://a:b@content.dropboxapi.com/2/files/download'],
    ['another port', 'https://api.dropboxapi.com:8443/oauth2/token'],
    ['a query string', 'https://api.dropboxapi.com/oauth2/token?refresh_token=x'],
    ['an unreadable address', 'not an address'],
  ])('refuses %s before the inner fetch runs', async (_name, address) => {
    const { seen, inner } = recorder()
    const failure = await failureOf(pinnedFetch(inner)(address))
    expect(failure.kind).toBe('other')
    expect(failure.detail).toBe('Request refused: the address is not a Dropbox API host')
    expect(seen).toEqual([])
  })

  it('refuses a Request object before the inner fetch runs', async () => {
    const { seen, inner } = recorder()
    const request = new Request('https://api.dropboxapi.com/oauth2/token')
    expect((await failureOf(pinnedFetch(inner)(request))).kind).toBe('other')
    expect(seen).toEqual([])
  })

  it.each([
    `https://${'api.dropboxapi.com'}/oauth2/token`,
    `https://${'content.dropboxapi.com'}/2/files/download`,
    'https://API.DropboxAPI.com/2/users/get_current_account',
    'https://api.dropboxapi.com:443/2/auth/token/revoke',
  ])('lets %s through with redirects an error and no credentials', async (address) => {
    const { seen, inner } = recorder()
    const response = await pinnedFetch(inner)(address, {
      method: 'POST',
      redirect: 'follow',
      credentials: 'include',
    })
    expect(response.status).toBe(200)
    expect(seen).toHaveLength(1)
    expect(seen[0]?.init).toMatchObject({ method: 'POST', redirect: 'error', credentials: 'omit' })
  })

  it.each([301, 302, 307, 308])(
    'refuses a %s redirect answer and does not follow it',
    async (s) => {
      const { seen, inner } = recorder(
        () => new Response(null, { status: s, headers: { location: 'https://example.com/' } }),
      )
      const failure = await failureOf(pinnedFetch(inner)('https://api.dropboxapi.com/oauth2/token'))
      expect(failure).toEqual({
        kind: 'other',
        detail: 'Request refused: Dropbox answered with a redirect',
      })
      expect(seen).toHaveLength(1)
    },
  )

  it('refuses a redirect that the inner fetch stopped under redirect: error', async () => {
    const stopped = new TypeError('fetch failed', { cause: new Error('unexpected redirect') })
    const inner: typeof fetch = () => Promise.reject(stopped)
    const failure = await failureOf(pinnedFetch(inner)('https://api.dropboxapi.com/oauth2/token'))
    expect(failure).toEqual({
      kind: 'other',
      detail: 'Request refused: Dropbox answered with a redirect',
    })
  })

  it('marks an error thrown by the network call, keeping none of its words', async () => {
    const inner: typeof fetch = () => Promise.reject(new TypeError('fetch failed secret-words'))
    const error = await pinnedFetch(inner)('https://api.dropboxapi.com/oauth2/token').catch(
      (e: unknown) => e,
    )
    expect(isDropboxNetworkError(error)).toBe(true)
    expect(String((error as Error).message)).not.toContain('secret-words')
    expect((error as { timedOut: boolean }).timedOut).toBe(false)
  })

  it('marks a time-out as a timed-out network error', async () => {
    const inner: typeof fetch = () =>
      Promise.reject(new DOMException('The operation timed out.', 'TimeoutError'))
    const error = await pinnedFetch(inner)('https://api.dropboxapi.com/oauth2/token').catch(
      (e: unknown) => e,
    )
    expect(isDropboxNetworkError(error)).toBe(true)
    expect((error as { timedOut: boolean }).timedOut).toBe(true)
  })

  it('is the default Dropbox fetch, which refuses another host before any socket opens', async () => {
    const failure = await failureOf(defaultDropboxFetch('https://example.com/'))
    expect(failure.kind).toBe('other')
  })
})

describe('pinnedFetch hardening [P9-3 hardening of P9-2]', () => {
  it('keeps no raw error as the cause of a network error, only its name', async () => {
    const inner: typeof fetch = () => Promise.reject(new TypeError('words with sl.secret-token'))
    const error = await pinnedFetch(inner)('https://api.dropboxapi.com/oauth2/token').catch(
      (e: unknown) => e,
    )
    expect(isDropboxNetworkError(error)).toBe(true)
    expect((error as Error).cause).toBeUndefined()
    expect((error as { causeName?: string }).causeName).toBe('TypeError')
    expect(JSON.stringify(error)).not.toContain('sl.secret-token')
    expect(String((error as Error).stack)).not.toContain('sl.secret-token')
  })

  it('forces dispatcher to undefined so a caller cannot send the request elsewhere', async () => {
    const { seen, inner } = recorder()
    const init = { method: 'POST', dispatcher: { elsewhere: true } } as RequestInit
    await pinnedFetch(inner)('https://api.dropboxapi.com/oauth2/token', init)
    const sent = seen[0]?.init as Record<string, unknown>
    expect('dispatcher' in sent).toBe(true)
    expect(sent.dispatcher).toBeUndefined()
  })
})
