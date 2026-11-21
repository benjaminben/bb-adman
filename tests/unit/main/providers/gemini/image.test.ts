import { describe, it, expect } from 'vitest'
import { adapters } from '../../../../../src/main/providers/gemini'
import { geminiImage } from '../../../../../src/main/providers/gemini/image'
import { ProviderFailure } from '../../../../../src/main/providers/types'
import {
  TEST_KEY,
  TEST_MODEL,
  fetchAnswering,
  first,
  jsonResponse,
  recorded,
  recordingFetch,
  testContext,
} from './recorded'

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const input = { prompt: 'A red bicycle', references: [], width: 1080, height: 1080, count: 1 }

describe('Gemini ImageProvider.generate [SPEC 6.2, slice E]', () => {
  it('returns the picture from a recorded response as PNG bytes with the model ID', async () => {
    const { fetchFn } = fetchAnswering('image-success.json')
    const results = await geminiImage(testContext(), { fetch: fetchFn }).generate(input)
    expect(results).toHaveLength(1)
    expect(first(results).model).toBe(TEST_MODEL)
    expect([...first(results).bytes.slice(0, 8)]).toEqual(PNG_SIGNATURE)
  })

  it('names a PNG picture image/png [SPEC 6.2 1.18, K1]', async () => {
    const { fetchFn } = fetchAnswering('image-success.json')
    const results = await geminiImage(testContext(), { fetch: fetchFn }).generate(input)
    expect(first(results).mime).toBe('image/png')
  })

  it('sends one generateContent request to the registry model with the key in a header', async () => {
    const { fetchFn, seen } = fetchAnswering('image-success.json')
    await geminiImage(testContext(), { fetch: fetchFn }).generate(input)
    expect(seen).toHaveLength(1)
    expect(first(seen).url).toContain(`models/${TEST_MODEL}:generateContent`)
    expect(first(seen).url).not.toContain(TEST_KEY)
    expect(first(seen).headers.get('x-goog-api-key')).toBe(TEST_KEY)
  })

  it('sends the prompt, then each reference picture as inline data', async () => {
    const { fetchFn, seen } = fetchAnswering('image-success.json')
    const references = [
      { bytes: new Uint8Array([1, 2, 3]), mime: 'image/png' },
      { bytes: new Uint8Array([4, 5]), mime: 'image/jpeg' },
    ]
    await geminiImage(testContext(), { fetch: fetchFn }).generate({ ...input, references })
    expect(first(seen).body.contents).toEqual([
      {
        role: 'user',
        parts: [
          { text: 'A red bicycle' },
          { inlineData: { mimeType: 'image/png', data: 'AQID' } },
          { inlineData: { mimeType: 'image/jpeg', data: 'BAU=' } },
        ],
      },
    ])
  })

  it('asks for image output in the supported aspect ratio nearest to the size', async () => {
    const { fetchFn, seen } = fetchAnswering('image-success.json')
    await geminiImage(testContext(), { fetch: fetchFn }).generate({
      ...input,
      width: 1080,
      height: 1920,
    })
    const config = first(seen).body.generationConfig as Record<string, unknown>
    expect(config.responseModalities).toEqual(['IMAGE'])
    expect(config.imageConfig).toEqual({ aspectRatio: '9:16' })
  })

  it('makes count calls, at most two at a time, and returns every picture [FR-063]', async () => {
    let running = 0
    let most = 0
    const { fetchFn, seen } = recordingFetch(async () => {
      running += 1
      most = Math.max(most, running)
      await new Promise((resolve) => setTimeout(resolve, 5))
      running -= 1
      return jsonResponse(recorded('image-success.json'))
    })
    const results = await geminiImage(testContext(), { fetch: fetchFn }).generate({
      ...input,
      count: 5,
    })
    expect(seen).toHaveLength(5)
    expect(results).toHaveLength(5)
    expect(most).toBe(2)
  })

  it('throws the failure when one of several calls fails', async () => {
    let calls = 0
    const { fetchFn } = recordingFetch(async () => {
      calls += 1
      return calls === 2
        ? jsonResponse(recorded('error-429-resource-exhausted.json'), 429)
        : jsonResponse(recorded('image-success.json'))
    })
    const run = geminiImage(testContext(), { fetch: fetchFn }).generate({ ...input, count: 3 })
    await expect(run).rejects.toMatchObject({ error: { kind: 'quota' } })
  })

  it('refuses a non-PNG picture with kind other, naming the type', async () => {
    const body = recorded('image-success.json') as {
      candidates: Array<{ content: { parts: Array<Record<string, unknown>> } }>
    }
    first(body.candidates).content.parts[1] = {
      inlineData: { mimeType: 'image/jpeg', data: 'AQID' },
    }
    const { fetchFn } = recordingFetch(async () => jsonResponse(body))
    const run = geminiImage(testContext(), { fetch: fetchFn }).generate(input)
    await expect(run).rejects.toMatchObject({ error: { kind: 'other' } })
    await expect(run).rejects.toThrow(ProviderFailure)
    await run.catch((e: ProviderFailure) => expect(e.error.detail).toContain('image/jpeg'))
  })
})

describe('Gemini ImageProvider.extend [SPEC 6.2, built in Phase 5]', () => {
  it('throws ProviderFailure of kind other until Phase 5 builds it', async () => {
    const provider = geminiImage(testContext())
    const run = provider.extend({
      image: { bytes: new Uint8Array(), mime: 'image/png' },
      placement: { x: 0, y: 0, width: 1, height: 1, rotation: 0, crop: null },
      width: 1,
      height: 1,
      prompt: 'p',
    })
    await expect(run).rejects.toThrow(ProviderFailure)
    await expect(run).rejects.toMatchObject({ error: { kind: 'other' } })
  })
})

describe('gemini/index.ts [SPEC 6.2]', () => {
  it('exports the image adapter only', () => {
    expect(Object.keys(adapters)).toEqual(['image'])
    expect(typeof adapters.image?.(testContext()).generate).toBe('function')
  })
})
