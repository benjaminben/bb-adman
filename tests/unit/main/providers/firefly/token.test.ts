import { describe, it, expect } from 'vitest'
import { FIREFLY_SCOPE, requestToken } from '@/main/providers/firefly/token'
import { ProviderFailure } from '@/main/providers/types'
import {
  TEST_CLIENT_ID,
  TEST_CLIENT_SECRET,
  TEST_TOKEN,
  first,
  jsonResponse,
  recorded,
  recordingFetch,
} from './recorded'

const signal = new AbortController().signal

function tokenWith(answer: () => Response) {
  const { fetchFn, seen } = recordingFetch(answer)
  const call = requestToken(
    fetchFn,
    { clientId: TEST_CLIENT_ID, clientSecret: TEST_CLIENT_SECRET },
    signal,
  )
  return { call, seen }
}

async function failureOf(call: Promise<unknown>): Promise<ProviderFailure> {
  const error = await call.then(
    () => undefined,
    (e: unknown) => e,
  )
  expect(error).toBeInstanceOf(ProviderFailure)
  return error as ProviderFailure
}

describe('Firefly token request [P4-6, spec/providers-adapters.md "Adobe Firefly (stub)"]', () => {
  it('posts the client credentials form to the Adobe sign-in host and reads the token', async () => {
    const { call, seen } = tokenWith(() => jsonResponse(recorded('token-success.json')))
    expect(await call).toBe(TEST_TOKEN)
    expect(seen).toHaveLength(1)
    const request = first(seen)
    expect(request.url).toBe('https://ims-na1.adobelogin.com/ims/token/v3')
    expect(request.method).toBe('POST')
    expect(request.headers.get('content-type')).toBe('application/x-www-form-urlencoded')
    expect(request.headers.get('authorization')).toBeNull()
    expect(Object.fromEntries(new URLSearchParams(request.body))).toEqual({
      grant_type: 'client_credentials',
      client_id: TEST_CLIENT_ID,
      client_secret: TEST_CLIENT_SECRET,
      scope: FIREFLY_SCOPE,
    })
  })

  it('asks for the scope the public documentation names', () => {
    expect(FIREFLY_SCOPE).toBe(
      'openid,AdobeID,session,additional_info,read_organizations,firefly_api,ff_apis',
    )
  })

  it.each([
    [
      'a refused client (400 invalid_client)',
      400,
      recorded('token-error-invalid-client.json'),
      'bad_key',
    ],
    ['HTTP 401', 401, { error: 'unauthorized' }, 'bad_key'],
    ['HTTP 429', 429, { error: 'too_many_requests' }, 'quota'],
    ['HTTP 500', 500, { error: 'server_error' }, 'other'],
    ['an answer with no token', 200, { token_type: 'bearer' }, 'other'],
  ] as const)('maps %s to %s', async (_case, status, body, kind) => {
    const { call } = tokenWith(() => jsonResponse(body, status))
    const failure = await failureOf(call)
    expect(failure.error.kind).toBe(kind)
  })

  it('removes both credentials from a detail that echoes them', async () => {
    const echo = {
      error: 'invalid_client',
      error_description: `${TEST_CLIENT_ID} ${TEST_CLIENT_SECRET}`,
    }
    const { call } = tokenWith(() => jsonResponse(echo, 400))
    const failure = await failureOf(call)
    expect(failure.error.detail).toContain('invalid_client')
    expect(failure.error.detail).not.toContain(TEST_CLIENT_ID)
    expect(failure.error.detail).not.toContain(TEST_CLIENT_SECRET)
  })

  it('maps a network error to offline', async () => {
    const { call } = tokenWith(() => {
      throw new TypeError('fetch failed')
    })
    expect((await failureOf(call)).error.kind).toBe('offline')
  })
})
