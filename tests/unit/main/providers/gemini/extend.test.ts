// spec/providers-adapters.md "Picture extend" (P5-6, A-128): one generateContent call through
// the pinned client, the picture as it is, the target's nearest aspect ratio, no canvas.
import { afterEach, describe, it, expect, vi } from 'vitest'
import { IMAGE_TIMEOUT_MS, geminiImage } from '@/main/providers/gemini/image'
import { GEMINI_ORIGIN, REDIRECT_REFUSED } from '@/main/providers/gemini/pinned-origin'
import { ProviderCancelled, ProviderFailure } from '@/main/providers/types'
import {
  TEST_KEY,
  TEST_MODEL,
  fetchAnswering,
  fetchThatHangs,
  first,
  jsonResponse,
  recorded,
  recordingFetch,
  testContext,
} from './recorded'

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const PICTURE = new Uint8Array([...PNG_SIGNATURE, 1, 2, 3, 4])
const input = {
  image: { bytes: PICTURE, mime: 'image/png' },
  placement: { x: 0, y: 420, width: 1080, height: 1080, rotation: 0, crop: null },
  width: 1080,
  height: 1920,
  prompt: 'Continue the scene outward.',
}

type Parts = Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>
type SentBody = {
  contents: Array<{ parts: Parts }>
  generationConfig: { responseModalities: string[]; imageConfig: { aspectRatio: string } }
}

function extendWith(fetchFn: typeof fetch, signal?: AbortSignal) {
  return geminiImage(testContext(), { fetch: fetchFn }).extend(input, { signal })
}

async function failureOf(run: Promise<unknown>): Promise<ProviderFailure> {
  const error = await run.then(
    () => undefined,
    (e: unknown) => e,
  )
  expect(error).toBeInstanceOf(ProviderFailure)
  return error as ProviderFailure
}

describe('Gemini ImageProvider.extend: the request [P5-6, A-128]', () => {
  it('sends the prompt, then the picture as one inlineData PNG part', async () => {
    const { fetchFn, seen } = fetchAnswering('image-success.json')
    await extendWith(fetchFn)
    expect(seen).toHaveLength(1)
    const body = first(seen).body as unknown as SentBody
    expect(first(body.contents).parts).toEqual([
      { text: input.prompt },
      { inlineData: { mimeType: 'image/png', data: Buffer.from(PICTURE).toString('base64') } },
    ])
  })

  it.each([
    [1080, 1920, '9:16'],
    [1920, 1080, '16:9'],
    [1080, 1080, '1:1'],
    [1080, 1350, '4:5'],
  ])('asks for the nearest ratio to %i x %i (%s), pictures only', async (w, h, ratio) => {
    const { fetchFn, seen } = fetchAnswering('image-success.json')
    const provider = geminiImage(testContext(), { fetch: fetchFn })
    await provider.extend({ ...input, width: w, height: h })
    const body = first(seen).body as unknown as SentBody
    expect(body.generationConfig.imageConfig).toEqual({ aspectRatio: ratio })
    expect(body.generationConfig.responseModalities).toEqual(['IMAGE'])
  })

  it('sends no placement', async () => {
    const { fetchFn, seen } = fetchAnswering('image-success.json')
    await extendWith(fetchFn)
    expect(JSON.stringify(first(seen).body)).not.toContain('placement')
  })
})

describe('Gemini ImageProvider.extend: the answer [P5-6]', () => {
  afterEach(() => vi.useRealTimers())

  it('returns the picture with the model ID', async () => {
    const { fetchFn } = fetchAnswering('image-success.json')
    const result = await extendWith(fetchFn)
    expect(result.model).toBe(TEST_MODEL)
    expect(result.mime).toBe('image/png')
    expect([...result.bytes.slice(0, 8)]).toEqual(PNG_SIGNATURE)
  })

  it('reads the type from the bytes: a JPEG answer stays image/jpeg', async () => {
    const { fetchFn } = fetchAnswering('image-success-jpeg.json')
    expect((await extendWith(fetchFn)).mime).toBe('image/jpeg')
  })

  it('sends nothing when the signal has already fired (ProviderCancelled)', async () => {
    const { fetchFn, seen } = fetchAnswering('image-success.json')
    const stop = new AbortController()
    stop.abort()
    const result = await extendWith(fetchFn, stop.signal).catch((e: unknown) => e)
    expect(result).toBeInstanceOf(ProviderCancelled)
    expect(seen).toHaveLength(0)
  })

  it('stops with ProviderCancelled when the signal fires during the call', async () => {
    const stop = new AbortController()
    const result = extendWith(fetchThatHangs().fetchFn, stop.signal).catch((e: unknown) => e)
    await new Promise((resolve) => setTimeout(resolve, 0))
    stop.abort()
    expect(await result).toBeInstanceOf(ProviderCancelled)
  })

  it.each([
    ['no-image.json', 200, 'other'],
    ['error-429-resource-exhausted.json', 429, 'quota'],
    ['error-401-unauthenticated.json', 401, 'bad_key'],
    ['finish-image-safety.json', 200, 'refused'],
  ])('maps %s (HTTP %i) to %s', async (name, status, kind) => {
    const { fetchFn } = fetchAnswering(name, status)
    expect((await failureOf(extendWith(fetchFn))).error.kind).toBe(kind)
  })

  it('maps no answer within 120 seconds to timeout, and not sooner', async () => {
    vi.useFakeTimers()
    let settled = false
    const run = extendWith(fetchThatHangs().fetchFn).finally(() => {
      settled = true
    })
    const failure = failureOf(run)
    await vi.advanceTimersByTimeAsync(IMAGE_TIMEOUT_MS - 1)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect((await failure).error.kind).toBe('timeout')
  })
})

describe('Gemini ImageProvider.extend: security [P5-6, full review]', () => {
  it('goes only to the pinned Gemini address, with redirect manual', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const fetchFn = async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return jsonResponse(recorded('image-success.json'))
    }
    await extendWith(fetchFn)
    expect(calls).toHaveLength(1)
    expect(first(calls).url.startsWith(`${GEMINI_ORIGIN}/`)).toBe(true)
    expect(first(calls).init?.redirect).toBe('manual')
  })

  it('does not follow a redirect: one call, kind other, the fixed detail', async () => {
    const answer = async () =>
      new Response(null, { status: 302, headers: { location: 'https://other.example/x' } })
    const { fetchFn, seen } = recordingFetch(answer)
    const failure = await failureOf(extendWith(fetchFn))
    expect(failure.error).toEqual({ kind: 'other', detail: REDIRECT_REFUSED })
    expect(seen).toHaveLength(1)
  })

  it('never puts the key in a failure, even when the provider echoes it', async () => {
    const echo = { error: { code: 429, message: `slow down ${TEST_KEY}`, status: 'X' } }
    const { fetchFn } = recordingFetch(async () => jsonResponse(echo, 429))
    const failure = await failureOf(extendWith(fetchFn))
    expect(failure.error.detail).not.toContain(TEST_KEY)
    expect(failure.message).not.toContain(TEST_KEY)
  })

  it('checks the answer bytes as a picture: claimed PNG that is not one is other', async () => {
    const body = recorded('image-success.json') as {
      candidates: Array<{ content: { parts: Array<Record<string, unknown>> } }>
    }
    const notPicture = Buffer.from('<script>not a picture</script>').toString('base64')
    first(body.candidates).content.parts[1] = {
      inlineData: { mimeType: 'image/png', data: notPicture },
    }
    const { fetchFn } = recordingFetch(async () => jsonResponse(body))
    const failure = await failureOf(extendWith(fetchFn))
    expect(failure.error.kind).toBe('other')
    expect(failure.error.detail).toBe('Picture is not a PNG or JPEG (type: image/png)')
  })

  it('drops the raw answer when it is not JSON', async () => {
    const raw = `not json ${TEST_KEY} secret-ish raw text`
    const { fetchFn } = recordingFetch(async () => new Response(raw, { status: 200 }))
    const failure = await failureOf(extendWith(fetchFn))
    expect(failure.error.kind).toBe('other')
    expect(failure.error.detail).not.toContain('raw text')
    expect(failure.error.detail).not.toContain(TEST_KEY)
  })
})
