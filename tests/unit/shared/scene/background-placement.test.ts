import { describe, expect, it } from 'vitest'
import { placePicture } from '@/shared/scene/background-placement'

const photo = { width: 800, height: 600 }
const square = { width: 400, height: 400 }

describe('placePicture [FR-090, FR-077]', () => {
  it.each([
    {
      name: 'cover with no crop fills the box and cuts the long side',
      crop: null,
      fit: 'cover' as const,
      want: { x: -66.666_666_666_666_66, y: 0, width: 533.333_333_333_333_4, height: 400 },
    },
    {
      name: 'contain with no crop fits the whole picture inside the box',
      crop: null,
      fit: 'contain' as const,
      want: { x: 0, y: 50, width: 400, height: 300 },
    },
    {
      name: 'a crop covers the box whatever the fit',
      crop: { x: 100, y: 100, width: 200, height: 200 },
      fit: 'contain' as const,
      want: { x: -200, y: -200, width: 1600, height: 1200 },
    },
    {
      name: 'a crop past the picture is cut to it first',
      crop: { x: 600, y: -100, width: 400, height: 400 },
      fit: 'cover' as const,
      want: { x: -1200, y: -100, width: 1600, height: 1200 },
    },
    {
      name: 'a crop with no area inside the picture counts as no crop',
      crop: { x: 900, y: 0, width: 100, height: 100 },
      fit: 'contain' as const,
      want: { x: 0, y: 50, width: 400, height: 300 },
    },
    {
      name: 'a crop of zero width counts as no crop',
      crop: { x: 10, y: 10, width: 0, height: 100 },
      fit: 'cover' as const,
      want: { x: -66.666_666_666_666_66, y: 0, width: 533.333_333_333_333_4, height: 400 },
    },
  ])('$name', ({ crop, fit, want }) => {
    const got = placePicture(photo, crop, square, fit)
    expect(got.x).toBeCloseTo(want.x, 9)
    expect(got.y).toBeCloseTo(want.y, 9)
    expect(got.width).toBeCloseTo(want.width, 9)
    expect(got.height).toBeCloseTo(want.height, 9)
  })

  it.each([
    { box: { width: 1080, height: 1350 }, fit: 'cover' as const, crop: null },
    { box: { width: 1080, height: 1350 }, fit: 'contain' as const, crop: null },
    {
      box: { width: 300, height: 100 },
      fit: 'cover' as const,
      crop: { x: 0, y: 0, width: 50, height: 400 },
    },
  ])(
    'never stretches: one scale for both sides ($fit into $box.width×$box.height)',
    ({ box, fit, crop }) => {
      const got = placePicture(photo, crop, box, fit)
      expect(got.width / photo.width).toBeCloseTo(got.height / photo.height, 12)
    },
  )

  it('does not round', () => {
    const got = placePicture({ width: 3, height: 7 }, null, { width: 10, height: 10 }, 'contain')
    expect(got.width).toBeCloseTo(30 / 7, 12)
    expect(Number.isInteger(got.x + got.y + got.width)).toBe(false)
  })
})
