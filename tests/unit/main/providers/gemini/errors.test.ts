import { afterEach, describe, it, expect, vi } from 'vitest'
import { IMAGE_TIMEOUT_MS, geminiImage } from '@/main/providers/gemini/image'
import { ProviderFailure } from '@/main/providers/types'
import { failureFromError } from '@/main/providers/gemini/failure'
import {
  TEST_KEY,
  fetchAnswering,
  fetchThatHangs,
  jsonResponse,
  recordingFetch,
  testContext,
} from './recorded'

const input = { prompt: 'A red bicycle', references: [], width: 1080, height: 1080, count: 1 }

async function failureOf(run: Promise<unknown>): Promise<ProviderFailure> {
  const error = await run.then(
    () => undefined,
    (e: unknown) => e,
  )
  expect(error).toBeInstanceOf(ProviderFailure)
  return error as ProviderFailure
}

function generateWith(fetchFn: typeof fetch) {
  return geminiImage(testContext(), { fetch: fetchFn }).generate(input)
}

describe('Gemini error mapping, one recorded response per kind [SPEC 6, 6.2, 10.1]', () => {
  afterEach(() => vi.useRealTimers())

  it.each([
    ['error-401-unauthenticated.json', 401],
    ['error-403-permission-denied.json', 403],
  ])('maps %s (HTTP %i) to bad_key', async (name, status) => {
    const { fetchFn } = fetchAnswering(name, status)
    const failure = await failureOf(generateWith(fetchFn))
    expect(failure.error.kind).toBe('bad_key')
    expect(failure.error.detail).toContain(String(status))
  })

  it('maps HTTP 429 to quota', async () => {
    const { fetchFn } = fetchAnswering('error-429-resource-exhausted.json', 429)
    const failure = await failureOf(generateWith(fetchFn))
    expect(failure.error.kind).toBe('quota')
    expect(failure.error.detail).toContain('RESOURCE_EXHAUSTED')
  })

  it('maps a blocked prompt to refused', async () => {
    const { fetchFn } = fetchAnswering('prompt-blocked.json')
    const failure = await failureOf(generateWith(fetchFn))
    expect(failure.error.kind).toBe('refused')
    expect(failure.error.detail).toContain('PROHIBITED_CONTENT')
  })

  it('maps a picture stopped for safety to refused', async () => {
    const { fetchFn } = fetchAnswering('finish-image-safety.json')
    const failure = await failureOf(generateWith(fetchFn))
    expect(failure.error.kind).toBe('refused')
    expect(failure.error.detail).toContain('IMAGE_SAFETY')
  })

  it('maps no answer within 120 seconds to timeout, and not sooner', async () => {
    vi.useFakeTimers()
    const { fetchFn } = fetchThatHangs()
    let settled = false
    const run = generateWith(fetchFn).finally(() => {
      settled = true
    })
    const failure = failureOf(run)
    await vi.advanceTimersByTimeAsync(IMAGE_TIMEOUT_MS - 1)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect((await failure).error.kind).toBe('timeout')
    expect(IMAGE_TIMEOUT_MS).toBe(120_000)
  })

  it('maps a network failure to offline', async () => {
    const { fetchFn } = recordingFetch(async () => {
      throw new TypeError('fetch failed', { cause: new Error('getaddrinfo ENOTFOUND') })
    })
    const failure = await failureOf(generateWith(fetchFn))
    expect(failure.error.kind).toBe('offline')
    expect(failure.error.detail).toContain('fetch failed')
  })

  it('maps HTTP 400 with reason API_KEY_INVALID to bad_key [1.11]', async () => {
    const { fetchFn } = fetchAnswering('error-400-api-key-invalid.json', 400)
    const failure = await failureOf(generateWith(fetchFn))
    expect(failure.error.kind).toBe('bad_key')
    expect(failure.error.detail).toContain('API_KEY_INVALID')
  })

  it('keeps any other HTTP 400 as other [1.11]', async () => {
    const { fetchFn } = fetchAnswering('error-400-invalid-argument.json', 400)
    const failure = await failureOf(generateWith(fetchFn))
    expect(failure.error.kind).toBe('other')
  })

  it('maps a picture stopped for recitation to refused [1.11]', async () => {
    const { fetchFn } = fetchAnswering('finish-recitation.json')
    const failure = await failureOf(generateWith(fetchFn))
    expect(failure.error.kind).toBe('refused')
    expect(failure.error.detail).toContain('RECITATION')
  })

  it('maps any other HTTP error to other', async () => {
    const { fetchFn } = fetchAnswering('error-500-internal.json', 500)
    const failure = await failureOf(generateWith(fetchFn))
    expect(failure.error.kind).toBe('other')
    expect(failure.error.detail).toContain('500')
  })

  it('maps an answer with no picture in it to other', async () => {
    const { fetchFn } = fetchAnswering('no-image.json')
    const failure = await failureOf(generateWith(fetchFn))
    expect(failure.error.kind).toBe('other')
  })
})

describe('Gemini adapter call rules [SPEC 6]', () => {
  it.each([429, 500, 503])('does not repeat a call that failed with HTTP %i', async (status) => {
    const { fetchFn, seen } = recordingFetch(async () =>
      jsonResponse({ error: { code: status, message: 'failed', status: 'X' } }, status),
    )
    await failureOf(generateWith(fetchFn))
    expect(seen).toHaveLength(1)
  })

  it('never puts the key in a failure, even when the provider echoes it', async () => {
    const echo = { error: { code: 400, message: `bad key ${TEST_KEY}`, status: 'X' } }
    const { fetchFn } = recordingFetch(async () => jsonResponse(echo, 400))
    const failure = await failureOf(generateWith(fetchFn))
    expect(failure.error.detail).not.toContain(TEST_KEY)
    expect(failure.message).not.toContain(TEST_KEY)
  })

  it('turns a secret that cannot be read into a ProviderFailure of kind other [1.12, G2]', async () => {
    const ctx = {
      ...testContext(),
      secret: (): string => {
        throw new Error('Secret not saved: gemini.apiKey')
      },
    }
    const failure = await failureOf(geminiImage(ctx).generate(input))
    expect(failure.error.kind).toBe('other')
    expect(failure.error.detail).not.toContain(TEST_KEY)
    expect(failure.message).not.toContain(TEST_KEY)
  })

  it('turns a model ID that cannot be read into a ProviderFailure of kind other [1.12, G2]', async () => {
    const ctx = {
      ...testContext(),
      model: (): string => {
        throw new Error('No model for gemini image')
      },
    }
    const failure = await failureOf(geminiImage(ctx).generate(input))
    expect(failure.error.kind).toBe('other')
    expect(failure.error.detail).not.toContain(TEST_KEY)
  })

  it('maps a TypeError thrown outside the network call to other, not offline [1.12, G3]', () => {
    const failure = failureFromError(new TypeError('x is not a function'), false, TEST_KEY)
    expect(failure.error.kind).toBe('other')
    expect(failure.error.detail).toContain('x is not a function')
  })

  it('removes the key in base64 form from a failure too [1.12, G4]', async () => {
    const base64 = Buffer.from(TEST_KEY).toString('base64')
    const echo = { error: { code: 400, message: `bad key ${base64}`, status: 'X' } }
    const { fetchFn } = recordingFetch(async () => jsonResponse(echo, 400))
    const failure = await failureOf(generateWith(fetchFn))
    expect(failure.error.detail).not.toContain(base64)
    expect(failure.error.detail).toContain('[key removed]')
  })
})

describe('Gemini: a break while the answer is read [SPEC 6.2 1.14, G8]', () => {
  it('maps a body that fails part way to offline', async () => {
    const { fetchFn } = recordingFetch(async () => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"candidates": [{"content"'))
          controller.error(new TypeError('terminated'))
        },
      })
      return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } })
    })
    const failure = await failureOf(generateWith(fetchFn))
    expect(failure.error.kind).toBe('offline')
  })
})

describe('Gemini: only the network call and the body read are marked [SPEC 6.5 1.16 A-08, H19]', () => {
  it('maps an error while the finished answer is built to other, not offline', async () => {
    // A status no Response may hold, so building the finished answer throws after the read.
    const odd = {
      status: 1000,
      statusText: '',
      headers: new Headers(),
      arrayBuffer: async () => new ArrayBuffer(0),
    }
    const { fetchFn } = recordingFetch(async () => odd as unknown as Response)
    const failure = await failureOf(generateWith(fetchFn))
    expect(failure.error.kind).toBe('other')
  })
})
