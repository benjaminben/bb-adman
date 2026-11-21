import { describe, it, expect } from 'vitest'
import { adapters } from '@/main/providers/gemini'
import { geminiText } from '@/main/providers/gemini/text'
import type { Brief } from '@/shared/schemas/brief'
import { answering, failureOf } from './json-answer'
import { TEST_KEY, TEST_MODEL, first, testContext } from './recorded'

type Body = {
  contents: Array<{ parts: Array<{ text?: string }> }>
  generationConfig: Record<string, unknown>
}

function bodyOf(seen: Array<{ body: Record<string, unknown> }>): Body {
  return first(seen).body as unknown as Body
}

const brief: Brief = {
  campaignName: 'Secret project name',
  region: 'Canada',
  audience: 'Young cyclists',
  message: 'Ride further for less',
  subjects: [{ name: 'Hidden subject name', description: 'Hidden subject description' }],
  offer: '20% off',
  callToAction: 'Book a test ride',
  tone: 'Cheerful',
  prohibitedWords: ['Forbidden-word'],
}

const copyInput = {
  role: 'call_to_action' as const,
  brief,
  language: 'fr-CA',
  count: 3,
  maxChars: 24,
}

const text = (fetchFn: typeof fetch) => geminiText(testContext(), { fetch: fetchFn })

describe('Gemini TextProvider.extractBrief [spec/providers-adapters.md "Layout and text"]', () => {
  it('is exported from the Gemini folder as the text adapter', () => {
    expect(adapters.text).toBeTypeOf('function')
  })

  it('sends the instruction, then the brief text after the line "Brief:"', async () => {
    const { fetchFn, seen } = answering(JSON.stringify({ region: 'Canada' }))
    await text(fetchFn).extractBrief({ text: 'Region: Canada\nAudience: cyclists' })
    const parts = first(bodyOf(seen).contents).parts
    expect(parts).toHaveLength(2)
    expect(first(parts).text).toContain('only from what the brief says')
    expect(parts[1]).toEqual({ text: 'Brief:\nRegion: Canada\nAudience: cyclists' })
  })

  it('asks the text model for a JSON answer with the brief fields, key in a header', async () => {
    const asked: string[] = []
    const ctx = { ...testContext(), model: (job: string) => (asked.push(job), TEST_MODEL) }
    const { fetchFn, seen } = answering(JSON.stringify({}))
    await geminiText(ctx, { fetch: fetchFn }).extractBrief({ text: 'x' })
    expect(asked).toEqual(['text'])
    expect(first(seen).url).toContain(`/v1/models/${TEST_MODEL}:generateContent`)
    expect(first(seen).headers.get('x-goog-api-key')).toBe(TEST_KEY)
    const config = bodyOf(seen).generationConfig
    expect(config.responseMimeType).toBe('application/json')
    const schema = JSON.stringify(config.responseSchema)
    for (const field of ['campaignName', 'region', 'audience', 'message', 'subjects']) {
      expect(schema).toContain(field)
    }
  })

  it('returns the draft, with unknown fields and fields of the wrong type dropped', async () => {
    const answer = { region: 'Canada', tone: 42, extra: 'x', subjects: [{ name: 'Bike' }] }
    const { fetchFn } = answering(JSON.stringify(answer))
    const draft = await text(fetchFn).extractBrief({ text: 'x' })
    expect(draft).toEqual({ region: 'Canada', subjects: [{ name: 'Bike' }] })
  })

  it.each([
    ['a non-JSON answer', 'The region is Canada.'],
    ['a JSON answer of the wrong shape', JSON.stringify(['Canada'])],
  ])('fails %s as other', async (_case, answer) => {
    const { fetchFn } = answering(answer)
    const failure = await failureOf(text(fetchFn).extractBrief({ text: 'x' }))
    expect(failure.error).toEqual({ kind: 'other', detail: 'Answer is not the asked JSON' })
  })
})

describe('Gemini TextProvider.copyOptions [spec/providers-adapters.md "Layout and text"]', () => {
  it('names the role, language, count, limit and the six brief fields in one part', async () => {
    const { fetchFn, seen } = answering(JSON.stringify({ options: ['Essayez-le'] }))
    await text(fetchFn).copyOptions(copyInput)
    const parts = first(bodyOf(seen).contents).parts
    expect(parts).toHaveLength(1)
    const instruction = String(first(parts).text)
    for (const fact of [
      'a call to action',
      'fr-CA',
      '3',
      '24',
      'Ride further for less',
      'Young cyclists',
      'Canada',
      'Cheerful',
      '20% off',
      'Book a test ride',
    ]) {
      expect(instruction).toContain(fact)
    }
  })

  it('sends no brief field beyond the six named [spec/ai-jobs.md "Security notes"]', async () => {
    const { fetchFn, seen } = answering(JSON.stringify({ options: [] }))
    await text(fetchFn).copyOptions(copyInput)
    const sent = JSON.stringify(first(seen).body)
    for (const hidden of ['Secret project name', 'Hidden subject', 'Forbidden-word']) {
      expect(sent).not.toContain(hidden)
    }
  })

  it('names a line of ad copy for the text role', async () => {
    const { fetchFn, seen } = answering(JSON.stringify({ options: [] }))
    await text(fetchFn).copyOptions({ ...copyInput, role: 'text' })
    expect(first(first(bodyOf(seen).contents).parts).text).toContain('a line of ad copy')
  })

  it('asks for a JSON answer with an options schema and returns the options as parsed', async () => {
    const options = ['Essayez-le', '  Réservez  ', 'Essayez-le']
    const { fetchFn, seen } = answering(JSON.stringify({ options }))
    expect(await text(fetchFn).copyOptions(copyInput)).toEqual(options)
    const config = bodyOf(seen).generationConfig
    expect(config.responseMimeType).toBe('application/json')
    expect(JSON.stringify(config.responseSchema)).toContain('options')
  })

  it.each([
    ['a non-JSON answer', 'Essayez-le!'],
    ['a JSON answer of the wrong shape', JSON.stringify({ options: [1, 2] })],
  ])('fails %s as other', async (_case, answer) => {
    const { fetchFn } = answering(answer)
    const failure = await failureOf(text(fetchFn).copyOptions(copyInput))
    expect(failure.error).toEqual({ kind: 'other', detail: 'Answer is not the asked JSON' })
  })
})
