import { describe, it, expect } from 'vitest'
import {
  FIREFLY_API_ORIGIN,
  FIREFLY_PICTURE_ORIGIN,
  FIREFLY_TOKEN_ORIGIN,
  REDIRECT_REFUSED,
  isNetworkError,
  pinnedFetch,
  type FireflyHost,
} from '@/main/providers/firefly/pinned-origin'
import { ProviderFailure } from '@/main/providers/types'
import { jsonResponse, recordingFetch } from './recorded'

const ORIGINS: Record<FireflyHost, string> = {
  token: FIREFLY_TOKEN_ORIGIN,
  api: FIREFLY_API_ORIGIN,
  picture: FIREFLY_PICTURE_ORIGIN,
}
const HOSTS = Object.keys(ORIGINS) as FireflyHost[]

async function failureOf(call: Promise<Response>): Promise<unknown> {
  return call.catch((error: unknown) => error)
}

describe('Firefly pinned hosts [P4-6, spec/providers.md "Rules for every adapter"]', () => {
  it('pins the documented hosts', () => {
    expect(FIREFLY_TOKEN_ORIGIN).toBe('https://ims-na1.adobelogin.com')
    expect(FIREFLY_API_ORIGIN).toBe('https://firefly-api.adobe.io')
    expect(FIREFLY_PICTURE_ORIGIN).toBe(
      'https://pre-signed-firefly-prod.s3-accelerate.amazonaws.com',
    )
  })

  it.each(HOSTS)('the %s wrapper passes a request to its own host through', async (host) => {
    const { fetchFn, seen } = recordingFetch(() => jsonResponse({ ok: true }))
    const response = await pinnedFetch(host, fetchFn)(`${ORIGINS[host]}/path`, { method: 'POST' })
    expect(response.status).toBe(200)
    expect(seen).toHaveLength(1)
  })

  const crossed = HOSTS.flatMap((host) =>
    HOSTS.filter((other) => other !== host).map((other) => [host, other] as const),
  )
  it.each(crossed)(
    'the %s wrapper refuses the %s host before anything is sent',
    async (host, other) => {
      const { fetchFn, seen } = recordingFetch(() => jsonResponse({ ok: true }))
      const error = await failureOf(pinnedFetch(host, fetchFn)(`${ORIGINS[other]}/path`))
      expect(error).toBeInstanceOf(ProviderFailure)
      expect(error).toMatchObject({ error: { kind: 'other' } })
      expect((error as ProviderFailure).error.detail).toContain(ORIGINS[other])
      expect(seen).toHaveLength(0)
    },
  )

  it.each([
    'https://firefly-environment.example/v3/images/generate-async',
    'http://firefly-api.adobe.io/v3/images/generate-async',
    'https://firefly-api.adobe.io:8443/v3/images/generate-async',
    'https://firefly-api.adobe.io.example/v3/images/generate-async',
    'https://ims-na1-stg1.adobelogin.com/ims/token/v3',
    'not an address',
  ])('the api wrapper refuses %s', async (address) => {
    const { fetchFn, seen } = recordingFetch(() => jsonResponse({ ok: true }))
    const error = await failureOf(pinnedFetch('api', fetchFn)(address))
    expect(error).toMatchObject({ error: { kind: 'other' } })
    expect(seen).toHaveLength(0)
  })

  it('accepts a URL object and a Request as well as a string', async () => {
    const { fetchFn, seen } = recordingFetch(() => jsonResponse({ ok: true }))
    const guarded = pinnedFetch('api', fetchFn)
    await guarded(new URL(`${FIREFLY_API_ORIGIN}/v3/status/x`))
    await guarded(new Request(`${FIREFLY_API_ORIGIN}/v3/status/x`))
    await expect(guarded(new Request(`${FIREFLY_TOKEN_ORIGIN}/x`))).rejects.toBeInstanceOf(
      ProviderFailure,
    )
    expect(seen).toHaveLength(2)
  })

  it('sends redirect manual and refuses a redirect answer without a second call', async () => {
    const inits: (RequestInit | undefined)[] = []
    const inner = async (_input: RequestInfo | URL, init?: RequestInit) => {
      inits.push(init)
      return new Response(null, { status: 302, headers: { location: 'https://other.example' } })
    }
    const call = pinnedFetch('token', inner)(`${FIREFLY_TOKEN_ORIGIN}/ims/token/v3`, {
      method: 'POST',
      redirect: 'follow',
    })
    const error = await failureOf(call)
    expect(error).toMatchObject({ error: { kind: 'other', detail: REDIRECT_REFUSED } })
    expect(inits).toHaveLength(1)
    expect(inits[0]?.redirect).toBe('manual')
  })

  it('stops reading an answer over the limit, as other', async () => {
    const inner = async () => new Response(new Uint8Array(11))
    const error = await failureOf(pinnedFetch('picture', inner, 10)(`${FIREFLY_PICTURE_ORIGIN}/x`))
    expect(error).toMatchObject({ error: { kind: 'other', detail: 'Answer too large' } })
    expect(isNetworkError(error)).toBe(false)
  })

  it('lets an answer exactly at the limit through', async () => {
    const inner = async () => new Response(new Uint8Array(10))
    const response = await pinnedFetch('picture', inner, 10)(`${FIREFLY_PICTURE_ORIGIN}/x`)
    expect((await response.arrayBuffer()).byteLength).toBe(10)
  })

  it('marks an error thrown by the network call itself, and nothing else', async () => {
    const inner = async (): Promise<Response> => {
      throw new TypeError('fetch failed')
    }
    const error = await failureOf(pinnedFetch('api', inner)(`${FIREFLY_API_ORIGIN}/x`))
    expect(isNetworkError(error)).toBe(true)
    expect(isNetworkError(new TypeError('fetch failed'))).toBe(false)
  })
})
