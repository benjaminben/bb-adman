// spec/screens-variants.md, "Fan-out" [P5-16]: the pairs, the new count and the fits to send.
import { describe, expect, it } from 'vitest'
import {
  fillsToStart,
  fanOutLists,
  fillCount,
  fitSizes,
  fitsToSend,
  formatsToSend,
  newCells,
  newPairs,
  startTicks,
  translationCount,
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

describe('fan-out model: formats [lows C, spec/data-rules.md fan-out step 7]', () => {
  it.each([
    ['image only, as newPairs', ['image'] as const, 4],
    ['video only: every video is new but the one 16x9 de', ['video'] as const, 5],
    ['image and video, each pair counted once per format', ['image', 'video'] as const, 9],
    ['no format makes nothing', [] as const, 0],
  ])('%s', (_name, formats, n) => {
    const t = ticks(['9x16', '16x9'], ['de'])
    expect(newCells(BASIS, t, formats)).toHaveLength(n)
  })

  it('lists the cells size by size, language by language, image before video', () => {
    expect(newCells(BASIS, ticks([], ['de']), ['video', 'image'])).toEqual([
      { sizeLabel: '1x1', language: 'en', format: 'video' },
      { sizeLabel: '1x1', language: 'de', format: 'image' },
      { sizeLabel: '1x1', language: 'de', format: 'video' },
    ])
  })

  it('counts a translation for a language whose only new variants are videos', () => {
    const deImage = { sizeLabel: '1x1', language: 'de', format: 'image' as const }
    const basis = { ...BASIS, existing: [...BASIS.existing, deImage] }
    expect(translationCount(basis, ticks([], ['de']))).toBe(0)
    expect(translationCount(basis, ticks([], ['de']), ['image', 'video'])).toBe(1)
  })

  it('sends the ticked formats in the order image, video', () => {
    expect(formatsToSend(['video', 'image'])).toEqual(['image', 'video'])
    expect(formatsToSend(['video'])).toEqual(['video'])
    expect(formatsToSend([])).toEqual([])
  })

  // A security review of DLG-4b: the reply may list more fills than the cost line showed (the
  // direction changed in between). Never more paid fills are started than the line named.
  it('starts at most as many fills as the cost line showed', () => {
    const fill = [{ variantId: 'V2' }, { variantId: 'V3' }, { variantId: 'V4' }]
    expect(fillsToStart(fill, 2)).toEqual([{ variantId: 'V2' }, { variantId: 'V3' }])
    expect(fillsToStart(fill, 0)).toEqual([])
    expect(fillsToStart(fill, 5)).toEqual(fill)
  })
})
