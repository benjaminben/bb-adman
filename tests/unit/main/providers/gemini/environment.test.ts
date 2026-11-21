import { afterEach, describe, it, expect } from 'vitest'
import { geminiImage } from '@/main/providers/gemini/image'
import { GEMINI_ORIGIN } from '@/main/providers/gemini/pinned-origin'
import { geminiText } from '@/main/providers/gemini/text'
import { answering } from './json-answer'
import { TEST_KEY, TEST_MODEL, fetchAnswering, first, testContext } from './recorded'

const savedEnv = { ...process.env }
afterEach(() => {
  process.env = { ...savedEnv }
})

// The nine variables @google/genai 3.6.1 reads, all set to other values.
const ENVIRONMENT = {
  GOOGLE_GEMINI_BASE_URL: 'https://gemini-environment.example',
  GOOGLE_VERTEX_BASE_URL: 'https://vertex-environment.example',
  GOOGLE_GENAI_USE_VERTEXAI: 'true',
  GOOGLE_GENAI_USE_ENTERPRISE: 'true',
  GOOGLE_API_KEY: 'environment-google-key-must-not-be-used',
  GEMINI_API_KEY: 'environment-gemini-key-must-not-be-used',
  GOOGLE_GENAI_API_VERSION: 'v0-environment',
  GOOGLE_CLOUD_PROJECT: 'environment-project',
  GOOGLE_CLOUD_LOCATION: 'environment-location',
}

const input = { prompt: 'A red bicycle', references: [], width: 1080, height: 1080, count: 1 }

describe('Gemini takes nothing from the environment [SPEC 6 1.12, 6.2 O-1, G1]', () => {
  it('goes to the pinned origin, on the Gemini API path, with the given key', async () => {
    Object.assign(process.env, ENVIRONMENT)
    const { fetchFn, seen } = fetchAnswering('image-success.json')
    const results = await geminiImage(testContext(), { fetch: fetchFn }).generate(input)
    expect(results).toHaveLength(1)
    expect(seen).toHaveLength(1)
    const url = new URL(first(seen).url)
    expect(url.origin).toBe(GEMINI_ORIGIN)
    expect(url.origin).toBe('https://generativelanguage.googleapis.com')
    expect(url.pathname).toBe(`/v1/models/${TEST_MODEL}:generateContent`)
    expect(first(seen).headers.get('x-goog-api-key')).toBe(TEST_KEY)
    expect(first(seen).headers.get('authorization')).toBeNull()
  })

  it('sends a text call to the pinned origin, on the Gemini API path, with the given key [P4-4]', async () => {
    Object.assign(process.env, ENVIRONMENT)
    const { fetchFn, seen } = answering(JSON.stringify({ region: 'Canada' }))
    const draft = await geminiText(testContext(), { fetch: fetchFn }).extractBrief({ text: 'x' })
    expect(draft).toEqual({ region: 'Canada' })
    expect(seen).toHaveLength(1)
    const url = new URL(first(seen).url)
    expect(url.origin).toBe('https://generativelanguage.googleapis.com')
    expect(url.pathname).toBe(`/v1/models/${TEST_MODEL}:generateContent`)
    expect(first(seen).headers.get('x-goog-api-key')).toBe(TEST_KEY)
    expect(first(seen).headers.get('authorization')).toBeNull()
  })
})
