// spec/editor.md, "Crop mode" [FR-077, FR-094]: the crop keeps the shape of the layer's box,
// stays inside the picture and is held in source pixels.
import { describe, expect, it } from 'vitest'
import {
  growCrop,
  moveCrop,
  resizeCrop,
  startCrop,
  toBoxPixels,
} from '@/renderer/editor/crop-overlay/crop-math'

const PHOTO = { width: 2000, height: 1000 }

const shapeOf = (r: { width: number; height: number }) => r.width / r.height

describe('startCrop: where the crop starts [FR-077]', () => {
  it.each([
    {
      name: 'no crop, a square box: the largest square in the middle of the picture',
      crop: null,
      box: { width: 500, height: 500 },
      want: { x: 500, y: 0, width: 1000, height: 1000 },
    },
    {
      name: 'no crop, a wide box: the full width, cut top and bottom',
      crop: null,
      box: { width: 400, height: 100 },
      want: { x: 0, y: 250, width: 2000, height: 500 },
    },
    {
      name: 'a crop of the box shape is kept as it is',
      crop: { x: 100, y: 200, width: 600, height: 300 },
      box: { width: 200, height: 100 },
      want: { x: 100, y: 200, width: 600, height: 300 },
    },
    {
      name: 'a crop of another shape: the part the box shows, in its middle',
      crop: { x: 100, y: 100, width: 400, height: 400 },
      box: { width: 200, height: 100 },
      want: { x: 100, y: 200, width: 400, height: 200 },
    },
    {
      name: 'a crop reaching outside the picture is first cut to it',
      crop: { x: -200, y: -100, width: 800, height: 500 },
      box: { width: 100, height: 100 },
      want: { x: 100, y: 0, width: 400, height: 400 },
    },
    {
      name: 'a crop with nothing left inside the picture counts as none',
      crop: { x: 3000, y: 0, width: 100, height: 100 },
      box: { width: 500, height: 500 },
      want: { x: 500, y: 0, width: 1000, height: 1000 },
    },
  ])('$name', ({ crop, box, want }) => {
    expect(startCrop(PHOTO, crop, box)).toEqual(want)
  })
})

describe('moveCrop: the crop moves and stays inside the picture', () => {
  const start = { x: 500, y: 250, width: 400, height: 200 }
  it.each([
    { name: 'inside', delta: { x: 100, y: -50 }, want: { x: 600, y: 200 } },
    { name: 'past the left and top', delta: { x: -900, y: -900 }, want: { x: 0, y: 0 } },
    { name: 'past the right and bottom', delta: { x: 5000, y: 5000 }, want: { x: 1600, y: 800 } },
  ])('$name', ({ delta, want }) => {
    expect(moveCrop(start, delta, PHOTO)).toEqual({ ...start, ...want })
  })
})

describe('resizeCrop: a handle resizes the crop at the box shape [FR-077]', () => {
  const start = { x: 500, y: 250, width: 400, height: 200 }
  const aspect = 2
  it.each([
    {
      name: 'the south-east corner grows; the north-west corner stays',
      handle: 'se' as const,
      delta: { x: 200, y: 0 },
      want: { x: 500, y: 250, width: 600, height: 300 },
    },
    {
      name: 'the corner takes the larger change of the two sides',
      handle: 'se' as const,
      delta: { x: 0, y: 150 },
      want: { x: 500, y: 250, width: 700, height: 350 },
    },
    {
      name: 'the north-west corner shrinks; the south-east corner stays',
      handle: 'nw' as const,
      delta: { x: 200, y: 100 },
      want: { x: 700, y: 350, width: 200, height: 100 },
    },
    {
      name: 'the east side grows about the middle of the height',
      handle: 'e' as const,
      delta: { x: 200, y: 0 },
      want: { x: 500, y: 200, width: 600, height: 300 },
    },
    {
      name: 'the north side grows about the middle of the width',
      handle: 'n' as const,
      delta: { x: 0, y: -100 },
      want: { x: 400, y: 150, width: 600, height: 300 },
    },
    {
      name: 'growing stops at the picture edge, keeping the shape',
      handle: 'se' as const,
      delta: { x: 5000, y: 0 },
      want: { x: 500, y: 250, width: 1500, height: 750 },
    },
    {
      name: 'a side stops where the other axis reaches the picture edge',
      handle: 'e' as const,
      delta: { x: 5000, y: 0 },
      want: { x: 500, y: 0, width: 1400, height: 700 },
    },
    {
      name: 'shrinking stops at 1 source pixel on the short side',
      handle: 'se' as const,
      delta: { x: -5000, y: 0 },
      want: { x: 500, y: 250, width: 2, height: 1 },
    },
  ])('$name', ({ handle, delta, want }) => {
    const got = resizeCrop(start, handle, delta, PHOTO, aspect)
    expect(got).toEqual(want)
    expect(shapeOf(got)).toBeCloseTo(aspect)
  })
})

describe('growCrop: the keyboard grows or shrinks the crop about its middle', () => {
  const aspect = 2
  it.each([
    {
      name: 'grows about the middle',
      start: { x: 500, y: 250, width: 400, height: 200 },
      by: 200,
      want: { x: 400, y: 200, width: 600, height: 300 },
    },
    {
      name: 'shrinks about the middle',
      start: { x: 500, y: 250, width: 400, height: 200 },
      by: -200,
      want: { x: 600, y: 300, width: 200, height: 100 },
    },
    {
      name: 'at an edge it grows into the picture instead',
      start: { x: 0, y: 0, width: 400, height: 200 },
      by: 200,
      want: { x: 0, y: 0, width: 600, height: 300 },
    },
    {
      name: 'never larger than the largest box shape inside the picture',
      start: { x: 500, y: 250, width: 400, height: 200 },
      by: 9000,
      want: { x: 0, y: 0, width: 2000, height: 1000 },
    },
  ])('$name', ({ start, by, want }) => {
    expect(growCrop(start, by, PHOTO, aspect)).toEqual(want)
  })
})

describe('toBoxPixels: a source rectangle drawn where the picture sits in the box', () => {
  it('scales and shifts by the picture place', () => {
    const place = { x: -100, y: 0, width: 1000, height: 500 }
    expect(toBoxPixels({ x: 200, y: 100, width: 400, height: 200 }, place, PHOTO)).toEqual({
      x: 0,
      y: 50,
      width: 200,
      height: 100,
    })
  })
})
