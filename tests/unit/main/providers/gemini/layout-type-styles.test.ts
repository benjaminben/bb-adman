// R2E-3 (spec/phases/round-2-editor.md D3): with type styles the layout instruction gains
// exactly two lines and the answer schema an optional typeStyle of the five ids; without them
// the instruction is word for word as before. A recorded reply only: no network call.
import { describe, it, expect } from 'vitest'
import { geminiLayout } from '@/main/providers/gemini/layout'
import { layoutInstruction } from '@/main/providers/gemini/prompts'
import { TYPE_STYLE_IDS, typeStylePrompt } from '@/shared/config/type-styles'
import { answering } from './json-answer'
import { first, testContext } from './recorded'

const base = {
  width: 1080,
  height: 1350,
  items: [{ slot: 'headline', text: 'Autumn market' }],
  palette: ['#112233'],
  fonts: ['Inter'],
}
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
const background = { bytes: new Uint8Array([1, 2, 3]), mime: 'image/png' }

const LINE_1 = `This ad has no brand fonts. For each box also give typeStyle, one of: ${JSON.stringify(typeStylePrompt())}.`
const LINE_2 = 'Choose a heavier style for the headline and a plainer one for small text.'

describe('layoutInstruction with type styles [R2E-3, D3]', () => {
  it('adds the two lines, and only them, when type styles are given', () => {
    const without = layoutInstruction(base).split('\n')
    const withStyles = layoutInstruction({ ...base, typeStyles: typeStylePrompt() }).split('\n')
    expect(withStyles).toEqual([...without, LINE_1, LINE_2])
  })

  it('names every id in the first line', () => {
    for (const id of TYPE_STYLE_IDS) expect(LINE_1).toContain(`"${id}"`)
  })

  it('is unchanged without type styles', () => {
    const text = layoutInstruction(base)
    expect(text).not.toContain('typeStyle')
    expect(text).not.toContain('brand fonts')
  })
})

describe('Gemini layout answer schema with typeStyle [R2E-3]', () => {
  type Schema = {
    properties: {
      boxes: {
        items: {
          properties: Record<string, unknown>
          required: string[]
          propertyOrdering: string[]
        }
      }
    }
  }

  async function sentSchema() {
    const { fetchFn, seen } = answering(JSON.stringify({ boxes: [box] }))
    await geminiLayout(testContext(), { fetch: fetchFn }).propose({ ...base, background })
    const config = first(seen).body.generationConfig as { responseSchema: Schema }
    return config.responseSchema.properties.boxes.items
  }

  it('offers typeStyle as an optional string of the five ids', async () => {
    const items = await sentSchema()
    expect(items.properties.typeStyle).toEqual({ type: 'STRING', enum: TYPE_STYLE_IDS })
    expect(items.required).not.toContain('typeStyle')
    expect(items.propertyOrdering).toContain('typeStyle')
  })

  it('passes a typeStyle through for the job to clamp, and reads an answer without one', async () => {
    const ask = (b: Record<string, unknown>) => {
      const { fetchFn } = answering(JSON.stringify({ boxes: [b] }))
      return geminiLayout(testContext(), { fetch: fetchFn }).propose({ ...base, background })
    }
    expect(await ask({ ...box, typeStyle: 'heavy' })).toEqual([{ ...box, typeStyle: 'heavy' }])
    expect(await ask(box)).toEqual([box])
  })

  it('drops a typeStyle that is not text instead of failing the whole answer', async () => {
    const { fetchFn } = answering(JSON.stringify({ boxes: [{ ...box, typeStyle: 7 }] }))
    const boxes = await geminiLayout(testContext(), { fetch: fetchFn }).propose({
      ...base,
      background,
    })
    expect(boxes).toEqual([box])
    expect(boxes[0]).not.toHaveProperty('typeStyle')
  })
})
