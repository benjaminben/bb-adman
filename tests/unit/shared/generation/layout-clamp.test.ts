import { describe, it, expect } from 'vitest'
import { clampLayout, type RawLayoutBox } from '@/shared/generation/layout-clamp'

const box = (over: Partial<RawLayoutBox> = {}): RawLayoutBox => ({
  slot: 'headline',
  x: 10,
  y: 20,
  width: 300,
  height: 100,
  fontSize: 40,
  color: '#112233',
  align: 'left',
  ...over,
})

const limits = { width: 1000, height: 500, palette: [] as string[], keys: ['headline', 'cta'] }
const one = (raw: RawLayoutBox, over: Partial<typeof limits> = {}) =>
  clampLayout([raw], { ...limits, ...over })[0]

describe('clampLayout [spec/ai-jobs.md "Layout proposal" step 5]', () => {
  it('keeps a box that is already inside the canvas as it is', () => {
    expect(one(box())).toEqual(box())
  })

  it('rounds every number', () => {
    expect(one(box({ x: 10.4, y: 20.6, width: 99.5, height: 50.2, fontSize: 12.7 }))).toMatchObject(
      { x: 10, y: 21, width: 100, height: 50, fontSize: 13 },
    )
  })

  it.each<[string, Partial<RawLayoutBox>, Partial<RawLayoutBox>]>([
    ['x below 0', { x: -50 }, { x: 0 }],
    ['x past the right edge', { x: 1200 }, { x: 999, width: 1 }],
    ['y below 0', { y: -3 }, { y: 0 }],
    ['y past the bottom', { y: 900 }, { y: 499, height: 1 }],
    ['width below 1', { width: 0 }, { width: 1 }],
    ['width past the right edge', { x: 900, width: 300 }, { width: 100 }],
    ['height below 1', { height: -10 }, { height: 1 }],
    ['height past the bottom', { y: 450, height: 100 }, { height: 50 }],
    ['fontSize below 1', { fontSize: 0.2 }, { fontSize: 1 }],
    ['fontSize above the canvas height', { fontSize: 900 }, { fontSize: 500 }],
  ])('clamps %s', (_, raw, expected) => {
    expect(one(box(raw))).toMatchObject(expected)
  })

  it('drops a box for a key that is not a text layer of the variant', () => {
    expect(clampLayout([box({ slot: 'logo' }), box({ slot: 'cta' })], limits)).toEqual([
      box({ slot: 'cta' }),
    ])
  })

  it('keeps only the first box of a repeated key', () => {
    const boxes = [box({ x: 1 }), box({ x: 2 }), box({ slot: 'cta', x: 3 })]
    expect(clampLayout(boxes, limits).map((b) => [b.slot, b.x])).toEqual([
      ['headline', 1],
      ['cta', 3],
    ])
  })

  it.each([NaN, Infinity, -Infinity])('drops a box with a number that is %s', (bad) => {
    for (const field of ['x', 'y', 'width', 'height', 'fontSize'] as const) {
      expect(clampLayout([box({ [field]: bad })], limits)).toEqual([])
    }
  })

  it.each(['red', '#12345', '#1234567', '112233', '#GG0000', ''])(
    'makes the colour %j null, so the layer keeps its own',
    (color) => {
      expect(one(box({ color }))?.color).toBeNull()
    },
  )

  it('snaps a colour to the nearest palette colour, in upper case', () => {
    const palette = ['#ff0000', '#00FF00', '#0000ff']
    expect(one(box({ color: '#EE1100' }), { palette })?.color).toBe('#FF0000')
    expect(one(box({ color: '#1010f0' }), { palette })?.color).toBe('#0000FF')
  })

  it('keeps a null colour null with a palette', () => {
    expect(one(box({ color: 'nope' }), { palette: ['#FF0000'] })?.color).toBeNull()
  })

  it('writes the colour in upper case without a palette too', () => {
    expect(one(box({ color: '#abcdef' }))?.color).toBe('#ABCDEF')
  })

  it.each(['justify', 'CENTER', ''])('makes the align %j center', (align) => {
    expect(one(box({ align }))?.align).toBe('center')
  })
})
