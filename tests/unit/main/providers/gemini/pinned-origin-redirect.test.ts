import { describe, it, expect } from 'vitest'
import { GEMINI_ORIGIN, pinnedFetch, REDIRECT_REFUSED } from '@/main/providers/gemini/pinned-origin'
import { ProviderFailure } from '@/main/providers/types'
import { jsonResponse } from './recorded'

const ADDRESS = `${GEMINI_ORIGIN}/v1/models/made-up-image-model:generateContent`

// A stand-in transport that records the `init` it was given.
function recordingInner(answer: () => Response) {
  const inits: (RequestInit | undefined)[] = []
  const inner = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    inits.push(init)
    return answer()
  }
  return { inner, inits }
}

describe('the Gemini request never follows a redirect [FN-2]', () => {
  it.each([undefined, 'follow', 'error', 'manual'] as const)(
    'sends redirect manual when the caller asked for %s',
    async (asked) => {
      const { inner, inits } = recordingInner(() => jsonResponse({ ok: true }))
      const init: RequestInit = { method: 'POST', headers: { 'x-goog-api-key': 'k' } }
      if (asked !== undefined) init.redirect = asked
      await pinnedFetch(inner)(ADDRESS, init)
      expect(inits).toHaveLength(1)
      expect(inits[0]?.redirect).toBe('manual')
      expect(inits[0]?.method).toBe('POST')
      expect(new Headers(inits[0]?.headers).get('x-goog-api-key')).toBe('k')
    },
  )

  it('sends redirect manual for a Request that carries follow', async () => {
    const { inner, inits } = recordingInner(() => jsonResponse({ ok: true }))
    await pinnedFetch(inner)(new Request(ADDRESS, { redirect: 'follow' }))
    expect(inits[0]?.redirect).toBe('manual')
  })

  it.each([301, 302, 303, 307, 308])(
    'a %s answer ends as kind other with the fixed detail and no second call',
    async (status) => {
      const { inner, inits } = recordingInner(
        () => new Response(null, { status, headers: { location: 'https://other.example/x' } }),
      )
      const call = pinnedFetch(inner)(ADDRESS, { method: 'POST' })
      await expect(call).rejects.toBeInstanceOf(ProviderFailure)
      await expect(call).rejects.toMatchObject({
        error: { kind: 'other', detail: REDIRECT_REFUSED },
      })
      expect(inits).toHaveLength(1)
    },
  )

  it('the detail is one fixed sentence that names no address', () => {
    expect(REDIRECT_REFUSED).toBe('Request refused: the Gemini host answered with a redirect')
  })
})
