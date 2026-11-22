// R2E-2 (spec/phases/round-2-editor.md D2, "The rule" 3 to 6): each placed box keeps its
// colour, gets a readable colour, or gets a solid text box behind it.
import { describe, it, expect } from 'vitest'
import type { Pixels } from '@/shared/generation/contrast'
import {
  keepReadable,
  type ReadableLayer,
  type ReadableStyle,
} from '@/shared/generation/layout-readable'
import type { LayoutJobBox } from '@/shared/schemas/jobs/layout-proposal'

const SIDE = 100

function picture(paint: (x: number) => number): Pixels {
  const rgba = new Uint8Array(SIDE * SIDE * 4)
  for (let i = 0; i < SIDE * SIDE; i += 1) {
    const v = paint(i % SIDE)
    rgba.set([v, v, v, 255], i * 4)
  }
  return { width: SIDE, height: SIDE, rgba }
}

const BLACK = picture(() => 0)
const WHITE = picture(() => 255)
const STRIPES = picture((x) => (x % 2 === 0 ? 0 : 255))

const box = (over: Partial<LayoutJobBox> = {}): LayoutJobBox => ({
  slot: 'headline',
  x: 10,
  y: 10,
  width: 80,
  height: 30,
  fontSize: 40,
  color: null,
  align: 'center',
  ...over,
})

const layer = (style: ReadableStyle = {}): ReadableLayer => ({
  key: 'headline',
  type: 'text',
  style: { color: '#FFFFFF', ...style },
})

type Case = {
  name: string
  pixels: Pixels
  palette?: string[]
  box?: Partial<LayoutJobBox>
  style?: ReadableStyle
  out: Partial<LayoutJobBox>
}

const cases: Case[] = [
  {
    name: 'keeps a colour that already reads',
    pixels: BLACK,
    box: { color: '#FFFFFF' },
    out: { color: '#FFFFFF', readable: 'kept' },
  },
  {
    name: "keeps the layer's own colour when the box has none",
    pixels: BLACK,
    out: { color: null, readable: 'kept' },
  },
  {
    name: 'chooses a brand colour that reads over white, leaving out one not #RRGGBB',
    pixels: BLACK,
    palette: ['red', '#333333', '#FFFF00'],
    box: { color: '#000000' },
    out: { color: '#FFFF00', readable: 'colour' },
  },
  {
    name: 'chooses white when no brand colour reaches 4.5',
    pixels: BLACK,
    palette: ['#0000FF'],
    box: { color: '#000000' },
    out: { color: '#FFFFFF', readable: 'colour' },
  },
  {
    name: 'chooses black on a white picture',
    pixels: WHITE,
    palette: ['#FFFF00'],
    out: { color: '#000000', readable: 'colour' },
  },
  {
    name: 'chooses black or white with no palette',
    pixels: WHITE,
    palette: [],
    box: { color: '#EEEEEE' },
    out: { color: '#000000', readable: 'colour' },
  },
  {
    name: 'adds a box over a striped picture, padded by a quarter of the font size',
    pixels: STRIPES,
    palette: ['#FF0000'],
    style: { color: '#FF0000' },
    out: { color: null, boxColor: '#000000', boxPadding: 10, readable: 'box' },
  },
  {
    name: 'adds a box in a brand colour that reads with the text, keeping the layer padding',
    pixels: STRIPES,
    palette: ['#FFEEEE', '#1A0000'],
    style: { color: '#FF0000', boxPadding: 12 },
    out: { color: null, boxColor: '#1A0000', boxPadding: 12, readable: 'box' },
  },
  {
    name: 'clamps the added padding to the look limit',
    pixels: STRIPES,
    style: { color: '#FF0000' },
    box: { fontSize: 9000 },
    out: { boxColor: '#000000', boxPadding: 2000, readable: 'box' },
  },
  {
    name: "uses the layer's text box colour as the ground",
    pixels: WHITE,
    style: { boxColor: '#000000' },
    out: { color: null, readable: 'kept' },
  },
  {
    name: 'leaves a box with no area in the picture as it is',
    pixels: WHITE,
    box: { x: 200 },
    out: { color: null, readable: 'kept' },
  },
]

describe('keepReadable [D2 rule 3 to 6]', () => {
  it.each(cases)('$name', (c) => {
    const [out] = keepReadable([box(c.box)], {
      pixels: c.pixels,
      scale: 1,
      palette: c.palette ?? [],
      layers: [layer(c.style)],
    })
    expect(out).toEqual({ ...box(c.box), ...c.out })
  })

  it('adds no box keys to a box it keeps or recolours', () => {
    const [out] = keepReadable([box()], {
      pixels: WHITE,
      scale: 1,
      palette: [],
      layers: [layer()],
    })
    expect(Object.keys(out ?? {})).not.toContain('boxColor')
    expect(Object.keys(out ?? {})).not.toContain('boxPadding')
  })

  it('leaves a box whose layer is not a text layer of the variant as it is', () => {
    const boxes = [box({ slot: 'other' })]
    const out = keepReadable(boxes, { pixels: WHITE, scale: 1, palette: [], layers: [layer()] })
    expect(out).toEqual(boxes)
  })
})
