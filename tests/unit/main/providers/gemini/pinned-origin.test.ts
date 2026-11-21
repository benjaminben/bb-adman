import { describe, it, expect } from 'vitest'
import {
  GEMINI_ORIGIN,
  isNetworkError,
  pinnedFetch,
} from '../../../../../src/main/providers/gemini/pinned-origin'
import { ProviderFailure } from '../../../../../src/main/providers/types'
import { jsonResponse, recordingFetch } from './recorded'

const PATH = '/v1/models/made-up-image-model:generateContent'

describe('Gemini fetch wrapper [SPEC 6 1.12, 6.2 O-1, G1]', () => {
  it('passes a request to the pinned origin through to the transport', async () => {
    const { fetchFn, seen } = recordingFetch(async () => jsonResponse({ ok: true }))
    const response = await pinnedFetch(fetchFn)(`${GEMINI_ORIGIN}${PATH}`, { method: 'POST' })
    expect(response.status).toBe(200)
    expect(seen).toHaveLength(1)
  })

  it.each([
    'https://gemini-environment.example' + PATH,
    'http://generativelanguage.googleapis.com' + PATH,
    'https://generativelanguage.googleapis.com:8443' + PATH,
    'https://aiplatform.googleapis.com' + PATH,
    'https://generativelanguage.googleapis.com.example' + PATH,
  ])('refuses %s with kind other before anything is sent', async (address) => {
    const { fetchFn, seen } = recordingFetch(async () => jsonResponse({ ok: true }))
    const call = pinnedFetch(fetchFn)(address, { method: 'POST' })
    await expect(call).rejects.toBeInstanceOf(ProviderFailure)
    await expect(call).rejects.toMatchObject({ error: { kind: 'other' } })
    expect(seen).toHaveLength(0)
  })

  it('accepts a URL object and a Request as well as a string', async () => {
    const { fetchFn, seen } = recordingFetch(async () => jsonResponse({ ok: true }))
    const guarded = pinnedFetch(fetchFn)
    await guarded(new URL(`${GEMINI_ORIGIN}${PATH}`))
    await guarded(new Request(`${GEMINI_ORIGIN}${PATH}`))
    await expect(guarded(new Request(`https://other.example${PATH}`))).rejects.toBeInstanceOf(
      ProviderFailure,
    )
    expect(seen).toHaveLength(2)
  })

  it('marks an error thrown by the network call itself', async () => {
    const { fetchFn } = recordingFetch(async () => {
      throw new TypeError('fetch failed')
    })
    const error = await pinnedFetch(fetchFn)(`${GEMINI_ORIGIN}${PATH}`).catch((e: unknown) => e)
    expect(isNetworkError(error)).toBe(true)
    expect((error as Error).message).toBe('fetch failed')
  })

  it('does not mark any other error', () => {
    expect(isNetworkError(new TypeError('fetch failed'))).toBe(false)
  })
})
