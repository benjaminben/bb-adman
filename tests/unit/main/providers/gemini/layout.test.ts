import { describe, it, expect } from 'vitest'
import { adapters } from '@/main/providers/gemini'
import { geminiLayout } from '@/main/providers/gemini/layout'
import { answering, failureOf } from './json-answer'
import { TEST_KEY, TEST_MODEL, first, jsonResponse, recordingFetch, testContext } from './recorded'

const box = {
  slot: 'headline',
  x: 40,
  y: 60,
  width: 900,
  height: 120,
  fontSize: 64,
  color: '#FFFFFF',
  align: 'center',
}

const input = {
  background: { bytes: new Uint8Array([1, 2, 3]), mime: 'image/png' },
  width: 1080,
  height: 1350,
  items: [
    { slot: 'headline', text: 'Summer sale' },
    { slot: 'call-to-action', text: 'Shop now' },
  ],
  palette: ['#112233', '#FFFFFF'],
  fonts: ['Inter', 'Lora'],
}

describe('Gemini LayoutProvider.propose [spec/providers-adapters.md "Layout and text"]', () => {
  it('is exported from the Gemini folder as the layout adapter', () => {
    expect(adapters.layout).toBeTypeOf('function')
  })

  it('sends the instruction first, then the background as one inline PNG part', async () => {
    const { fetchFn, seen } = answering(JSON.stringify({ boxes: [box] }))
    await geminiLayout(testContext(), { fetch: fetchFn }).propose(input)
    const contents = first(seen).body.contents as Array<{ parts: Array<Record<string, unknown>> }>
    expect(contents).toHaveLength(1)
    const parts = first(contents).parts
    expect(parts).toHaveLength(2)
    expect(parts[1]).toEqual({ inlineData: { mimeType: 'image/png', data: 'AQID' } })
    const instruction = String(first(parts).text)
    for (const fact of ['1080', '1350', 'Summer sale', 'call-to-action', '#112233', 'Lora']) {
      expect(instruction).toContain(fact)
    }
  })

  it('asks for a JSON answer with a boxes schema, from the layout model, key in a header', async () => {
    const { fetchFn, seen } = answering(JSON.stringify({ boxes: [box] }))
    await geminiLayout(testContext(), { fetch: fetchFn }).propose(input)
    const request = first(seen)
    expect(request.url).toContain(`/v1/models/${TEST_MODEL}:generateContent`)
    expect(request.url).not.toContain(TEST_KEY)
    expect(request.headers.get('x-goog-api-key')).toBe(TEST_KEY)
    const config = request.body.generationConfig as Record<string, unknown>
    expect(config.responseMimeType).toBe('application/json')
    expect(JSON.stringify(config.responseSchema)).toContain('boxes')
    expect(config.responseModalities).toBeUndefined()
  })

  it('reads the model for the layout job', async () => {
    const asked: string[] = []
    const ctx = { ...testContext(), model: (job: string) => (asked.push(job), TEST_MODEL) }
    const { fetchFn } = answering(JSON.stringify({ boxes: [box] }))
    await geminiLayout(ctx, { fetch: fetchFn }).propose(input)
    expect(asked).toEqual(['layout'])
  })

  it('returns the boxes of a good answer as parsed', async () => {
    const second = { ...box, slot: 'call-to-action', align: 'left', x: -5 }
    const { fetchFn } = answering(JSON.stringify({ boxes: [box, second] }))
    const boxes = await geminiLayout(testContext(), { fetch: fetchFn }).propose(input)
    expect(boxes).toEqual([box, second])
  })

  it('passes a colour that is not #RRGGBB through, for the job to clamp', async () => {
    const { fetchFn } = answering(JSON.stringify({ boxes: [{ ...box, color: 'red' }] }))
    const boxes = await geminiLayout(testContext(), { fetch: fetchFn }).propose(input)
    expect(boxes).toEqual([{ ...box, color: 'red' }])
  })

  it.each([
    ['a non-JSON answer', 'Here is your layout: boxes go at the top.'],
    [
      'a JSON answer of the wrong shape',
      JSON.stringify({ boxes: [{ slot: 'headline', x: '40' }] }),
    ],
    ['a JSON answer with no boxes', JSON.stringify({ layout: [] })],
    ['an align outside the three', JSON.stringify({ boxes: [{ ...box, align: 'justify' }] })],
  ])('fails %s as other, without the answer text in the detail', async (_case, text) => {
    const { fetchFn } = answering(text)
    const failure = await failureOf(geminiLayout(testContext(), { fetch: fetchFn }).propose(input))
    expect(failure.error).toEqual({ kind: 'other', detail: 'Answer is not the asked JSON' })
  })

  it('fails an answer with no text part as other', async () => {
    const empty = { candidates: [{ content: { parts: [] }, finishReason: 'STOP' }] }
    const { fetchFn } = recordingFetch(async () => jsonResponse(empty))
    const failure = await failureOf(geminiLayout(testContext(), { fetch: fetchFn }).propose(input))
    expect(failure.error).toEqual({ kind: 'other', detail: 'Answer is not the asked JSON' })
  })
})
