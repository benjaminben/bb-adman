import { afterEach, describe, it, expect, vi } from 'vitest'
import { TEXT_TIMEOUT_MS } from '@/main/providers/gemini/json-call'
import { geminiLayout } from '@/main/providers/gemini/layout'
import { geminiText } from '@/main/providers/gemini/text'
import { ProviderCancelled, type AdapterContext } from '@/main/providers/types'
import type { Brief } from '@/shared/schemas/brief'
import { failureOf, textAnswer } from './json-answer'
import {
  TEST_KEY,
  fetchAnswering,
  fetchThatHangs,
  jsonResponse,
  recordingFetch,
  testContext,
} from './recorded'

const brief: Brief = {
  campaignName: 'C',
  region: 'R',
  audience: 'A',
  message: 'M',
  subjects: [{ name: 'S' }],
}
const layoutInput = {
  background: { bytes: new Uint8Array([1]), mime: 'image/png' },
  width: 100,
  height: 100,
  items: [{ slot: 'headline', text: 'Hi' }],
  palette: [],
  fonts: ['Inter'],
}

type Run = (fetchFn: typeof fetch, signal?: AbortSignal, ctx?: AdapterContext) => Promise<unknown>

// Each of the four JSON calls, run with a given transport.
const calls: Array<[string, Run]> = [
  [
    'extract brief',
    (f, signal, ctx = testContext()) =>
      geminiText(ctx, { fetch: f }).extractBrief({ text: 'Region: R' }, { signal }),
  ],
  [
    'copy options',
    (f, signal, ctx = testContext()) =>
      geminiText(ctx, { fetch: f }).copyOptions(
        { role: 'text', brief, language: 'en', count: 2, maxChars: 40 },
        { signal },
      ),
  ],
  [
    'translate',
    (f, signal, ctx = testContext()) =>
      geminiText(ctx, { fetch: f }).translate(
        { items: [{ key: 'k', text: 'Hi' }], from: 'en', to: 'de', region: 'R', audience: 'A' },
        { signal },
      ),
  ],
  [
    'layout',
    (f, signal, ctx = testContext()) =>
      geminiLayout(ctx, { fetch: f }).propose(layoutInput, { signal }),
  ],
]

const networkDown = () =>
  recordingFetch(async () => {
    throw new TypeError('fetch failed', { cause: new Error('getaddrinfo ENOTFOUND') })
  })

const errorCases: Array<[string, () => { fetchFn: typeof fetch }, string, string]> = [
  ['HTTP 401', () => fetchAnswering('error-401-unauthenticated.json', 401), 'bad_key', '401'],
  [
    'HTTP 400 API_KEY_INVALID',
    () => fetchAnswering('error-400-api-key-invalid.json', 400),
    'bad_key',
    'API_KEY_INVALID',
  ],
  [
    'HTTP 429',
    () => fetchAnswering('error-429-resource-exhausted.json', 429),
    'quota',
    'RESOURCE_EXHAUSTED',
  ],
  [
    'a blocked prompt',
    () => fetchAnswering('prompt-blocked.json'),
    'refused',
    'PROHIBITED_CONTENT',
  ],
  [
    'an answer stopped for safety',
    () => recordingFetch(async () => jsonResponse(textAnswer('{', 'SAFETY'))),
    'refused',
    'SAFETY',
  ],
  ['a marked network error', networkDown, 'offline', 'fetch failed'],
]

describe.each(calls)('Gemini %s: error mapping [spec/providers-adapters.md]', (_name, run) => {
  afterEach(() => vi.useRealTimers())

  it.each(errorCases)('maps %s to its kind', async (_case, transport, kind, word) => {
    const failure = await failureOf(run(transport().fetchFn))
    expect(failure.error.kind).toBe(kind)
    expect(failure.error.detail).toContain(word)
  })

  it('maps no answer within 60 seconds to timeout, and not sooner', async () => {
    vi.useFakeTimers()
    let settled = false
    const result = run(fetchThatHangs().fetchFn).finally(() => {
      settled = true
    })
    const failure = failureOf(result)
    await vi.advanceTimersByTimeAsync(TEXT_TIMEOUT_MS - 1)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect((await failure).error.kind).toBe('timeout')
    expect(TEXT_TIMEOUT_MS).toBe(60_000)
  })

  it('stops with ProviderCancelled when the run signal aborts during the call', async () => {
    const stop = new AbortController()
    const result = run(fetchThatHangs().fetchFn, stop.signal).catch((e: unknown) => e)
    await new Promise((resolve) => setTimeout(resolve, 0))
    stop.abort()
    expect(await result).toBeInstanceOf(ProviderCancelled)
  })

  it('sends nothing when the run signal has already aborted', async () => {
    const { fetchFn, seen } = fetchAnswering('error-429-resource-exhausted.json', 429)
    const result = await run(fetchFn, AbortSignal.abort()).catch((e: unknown) => e)
    expect(result).toBeInstanceOf(ProviderCancelled)
    expect(seen).toHaveLength(0)
  })

  it('does not repeat a call that failed with HTTP 429', async () => {
    const { fetchFn, seen } = fetchAnswering('error-429-resource-exhausted.json', 429)
    await failureOf(run(fetchFn))
    expect(seen).toHaveLength(1)
  })

  it('turns a secret that cannot be read into a ProviderFailure of kind other', async () => {
    const ctx = {
      ...testContext(),
      secret: (): string => {
        throw new Error('Secret not saved: gemini.apiKey')
      },
    }
    const { fetchFn, seen } = fetchAnswering('prompt-blocked.json')
    const failure = await failureOf(run(fetchFn, undefined, ctx))
    expect(failure.error.kind).toBe('other')
    expect(seen).toHaveLength(0)
  })
})

// A key planted in an error answer, as given and in base64 (the test key has no character
// that URL encoding changes).
const plantedForms: Array<[string, string]> = [
  ['as given', TEST_KEY],
  ['base64', Buffer.from(TEST_KEY).toString('base64')],
]

// Every path a detail can take: an HTTP error body, a block reason, a finish reason, a network
// error message.
function plantedTransports(planted: string): Array<[string, () => { fetchFn: typeof fetch }]> {
  const error = (status: number) => ({
    error: { code: status, message: `key ${planted}`, status: 'X' },
  })
  return [
    ['HTTP 400', () => recordingFetch(async () => jsonResponse(error(400), 400))],
    ['HTTP 429', () => recordingFetch(async () => jsonResponse(error(429), 429))],
    ['HTTP 500', () => recordingFetch(async () => jsonResponse(error(500), 500))],
    [
      'a block reason',
      () => recordingFetch(async () => jsonResponse({ promptFeedback: { blockReason: planted } })),
    ],
    ['a finish reason', () => recordingFetch(async () => jsonResponse(textAnswer('{', planted)))],
    [
      'a network error',
      () =>
        recordingFetch(async () => {
          throw new TypeError(`fetch failed ${planted}`)
        }),
    ],
  ]
}

describe.each(calls)('Gemini %s: a key planted in an error answer', (_name, run) => {
  describe.each(plantedForms)('%s', (_form, planted) => {
    it.each(plantedTransports(planted))(
      'is removed from the detail of %s',
      async (_p, transport) => {
        const failure = await failureOf(run(transport().fetchFn))
        expect(failure.error.detail).not.toContain(planted)
        expect(failure.error.detail).not.toContain(TEST_KEY)
        expect(failure.message).not.toContain(TEST_KEY)
      },
    )
  })
})

describe.each(calls)('Gemini %s: an answer that is not JSON', (_name, run) => {
  it('fails as other with a fixed detail that quotes nothing of the answer', async () => {
    const { fetchFn } = recordingFetch(async () => new Response('not json made-up-answer-text'))
    const failure = await failureOf(run(fetchFn))
    expect(failure.error.kind).toBe('other')
    expect(failure.error.detail).toBe('Answer is not JSON')
    expect(`${failure.message} ${failure.error.detail}`).not.toContain('not json')
  })
})
