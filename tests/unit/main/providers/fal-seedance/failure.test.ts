import { describe, expect, it } from 'vitest'
import { falThrownFailure } from '@/main/providers/fal-seedance/failure'
import { falVideo } from '@/main/providers/fal-seedance/video'
import { ProviderFailure, type ProviderError } from '@/main/providers/types'
import { TEST_KEY, json, standIn, testContext, type Route } from './stand-in'

const input = { prompt: 'A kite over a hill', durationMs: 5_000, width: 1080, height: 1080 }
const prompt = { ...input, image: null, references: [] }

// Every answer below quotes the key and some raw text, to show neither reaches the detail.
const leak = `key ${TEST_KEY} raw-provider-text`
const policy = { detail: [{ type: 'content_policy_violation', msg: leak }] }

async function errorOf(route: Route, extra: { callMs?: number } = {}): Promise<ProviderError> {
  const { fetchFn } = standIn(route)
  const run = falVideo(testContext(), { fetch: fetchFn, ...extra }).start(prompt)
  const error = await run.catch((e: unknown) => e)
  if (!(error instanceof ProviderFailure)) throw new Error('expected a ProviderFailure')
  return error.error
}

const hangs: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
  })

describe('fal Seedance error kinds [P7-14, spec/providers-adapters.md fal error mapping]', () => {
  it.each([
    { what: 'HTTP 401', route: () => json({ detail: leak }, 401), kind: 'bad_key' },
    { what: 'HTTP 403', route: () => json({ detail: leak }, 403), kind: 'bad_key' },
    { what: 'HTTP 429', route: () => json({ detail: leak }, 429), kind: 'quota' },
    { what: 'a content rule', route: () => json(policy, 422), kind: 'refused' },
    {
      what: 'any other 422',
      route: () => json({ detail: [{ type: 'missing', msg: leak }] }, 422),
      kind: 'other',
    },
    { what: 'HTTP 500', route: () => json({ detail: leak }, 500), kind: 'other' },
    { what: 'an answer that is not JSON', route: () => new Response(leak), kind: 'other' },
    {
      what: 'a network error',
      route: () => {
        throw new TypeError(leak)
      },
      kind: 'offline',
    },
  ])('$what is $kind, with no key and no raw text in the detail', async ({ route, kind }) => {
    const error = await errorOf(route)
    expect(error.kind).toBe(kind)
    expect(error.detail).not.toContain(TEST_KEY)
    expect(error.detail).not.toContain('raw-provider-text')
  })

  it('no answer within the call limit is timeout', async () => {
    const error = await falVideo(testContext(), { fetch: hangs, callMs: 5 })
      .start(prompt)
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ProviderFailure)
    expect((error as ProviderFailure).error.kind).toBe('timeout')
  })

  it('a key the header cannot carry fails as other without the key in the detail', async () => {
    const badKey = 'made-up\nvalue'
    const { fetchFn, seen } = standIn(() => json({}))
    const error = await falVideo(testContext(badKey), { fetch: fetchFn })
      .start(prompt)
      .catch((e: unknown) => e)
    expect((error as ProviderFailure).error.kind).toBe('other')
    expect((error as ProviderFailure).error.detail).not.toContain('made-up')
    expect(seen).toHaveLength(0)
  })

  it('redactSecret removes the key from a detail that already holds it', () => {
    const inner = new ProviderFailure({ kind: 'other', detail: `quoted ${TEST_KEY}` })
    const failure = falThrownFailure(inner, false, TEST_KEY)
    expect(failure.error.detail).not.toContain(TEST_KEY)
    expect(failure.error.detail).toContain('[key removed]')
  })
})
