// spec/screens-variants.md, "Fan-out" [P5-16]: the pairs, the new count and the fits to send.
import { describe, expect, it } from 'vitest'
import {
  fanOutLists,
  fillCount,
  fitSizes,
  fitsToSend,
  newPairs,
  startTicks,
  type FanOutBasis,
  type FanOutTicks,
} from '@/renderer/dialogs/fan-out/fan-out-model'

const SQUARE = { label: '1x1', width: 1080, height: 1080 }
const TALL = { label: '9x16', width: 1080, height: 1920 }
const WIDE = { label: '16x9', width: 1920, height: 1080 }
const SAME_PIXELS = { label: '1080x1080', width: 1080, height: 1080 }

const BASIS: FanOutBasis = {
  sizes: [SQUARE, TALL, WIDE, SAME_PIXELS],
  languages: ['en', 'de', 'fr'],
  master: { sizeLabel: '1x1', language: 'en', width: 1080, height: 1080 },
  existing: [
    { sizeLabel: '1x1', language: 'en', format: 'image' },
    { sizeLabel: '9x16', language: 'en', format: 'image' },
    { sizeLabel: '16x9', language: 'de', format: 'video' },
  ],
}

const ticks = (sizes: string[], languages: string[]): FanOutTicks => ({ sizes, languages })

describe("fan-out model: pairs, count and fits [P5-16, spec/screens-variants.md 'Fan-out']", () => {
  it("starts with the master's size and language ticked", () => {
    expect(startTicks(BASIS)).toEqual(ticks(['1x1'], ['en']))
  })

  it.each([
    ['nothing more ticked', ticks([], []), { sizes: ['1x1'], languages: ['en'] }, []],
    [
      'the master pair is always in, ticks come in campaign order',
      ticks(['16x9', '9x16'], []),
      { sizes: ['1x1', '9x16', '16x9'], languages: ['en'] },
      [{ sizeLabel: '16x9', language: 'en' }],
    ],
    [
      'an existing image pair is not counted; a video pair does not count as one',
      ticks(['9x16', '16x9'], ['de']),
      { sizes: ['1x1', '9x16', '16x9'], languages: ['en', 'de'] },
      [
        { sizeLabel: '1x1', language: 'de' },
        { sizeLabel: '9x16', language: 'de' },
        { sizeLabel: '16x9', language: 'en' },
        { sizeLabel: '16x9', language: 'de' },
      ],
    ],
    [
      'a new language alone makes the master size in it',
      ticks([], ['fr']),
      { sizes: ['1x1'], languages: ['en', 'fr'] },
      [{ sizeLabel: '1x1', language: 'fr' }],
    ],
  ])('%s', (_name, t, lists, pairs) => {
    expect(fanOutLists(BASIS, t)).toEqual(lists)
    expect(newPairs(BASIS, t)).toEqual(pairs)
  })

  it('a label or tag not in the campaign is never sent', () => {
    expect(fanOutLists(BASIS, ticks(['4x5'], ['it']))).toEqual({
      sizes: ['1x1'],
      languages: ['en'],
    })
  })

  it('leaves out a master size the campaign does not list, and counts nothing without a size', () => {
    const basis = { ...BASIS, master: { ...BASIS.master, sizeLabel: '2x3' } }
    expect(fanOutLists(basis, ticks([], ['de']))).toEqual({ sizes: [], languages: ['en', 'de'] })
    expect(newPairs(basis, ticks([], ['de']))).toEqual([])
  })

  it('wants a fit only for ticked sizes of another pixel size', () => {
    const t = ticks(['9x16', '1080x1080', '16x9'], [])
    expect(fitSizes(BASIS, t)).toEqual([TALL, WIDE])
  })

  it.each([
    [
      'the chosen fits, scale where none is chosen',
      true,
      { '9x16': 'fill' },
      { '9x16': 'fill', '16x9': 'scale' },
    ],
    ['crop is kept', true, { '16x9': 'crop' }, { '9x16': 'scale', '16x9': 'crop' }],
    [
      'no background picture sends scale for each',
      false,
      { '9x16': 'fill', '16x9': 'crop' },
      { '9x16': 'scale', '16x9': 'scale' },
    ],
    [
      'a fit for a size not ticked is dropped',
      true,
      { '4x5': 'fill' },
      { '9x16': 'scale', '16x9': 'scale' },
    ],
  ] as const)('%s', (_name, picture, chosen, sent) => {
    const t = ticks(['9x16', '16x9'], [])
    expect(fitsToSend(BASIS, t, chosen, picture)).toEqual(sent)
  })

  it('counts the sizes with fill', () => {
    expect(fillCount({ '9x16': 'fill', '16x9': 'scale', '4x5': 'fill' })).toBe(2)
    expect(fillCount({})).toBe(0)
  })
})
