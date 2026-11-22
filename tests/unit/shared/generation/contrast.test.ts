// R2E-2 (spec/phases/round-2-editor.md D2, "The rule" 1 and 2): WCAG 2 luminance and contrast,
// and the ground under a box read from the picture's pixels.
import { describe, it, expect } from 'vitest'
import { contrastRatio, groundOf, luminance, type Pixels } from '@/shared/generation/contrast'

// A picture of the given size, each pixel coloured by `paint(x, y)` as [r, g, b, a].
function picture(width: number, height: number, paint: (x: number, y: number) => number[]): Pixels {
  const rgba = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) rgba.set(paint(x, y), (y * width + x) * 4)
  }
  return { width, height, rgba }
}

const WHITE = [255, 255, 255, 255]
const BLACK = [0, 0, 0, 255]

describe('luminance and contrastRatio [D2 rule 1]', () => {
  it.each<[string, number]>([
    ['#FFFFFF', 1],
    ['#000000', 0],
    ['#777777', 0.1845],
  ])('gives %s a luminance of %d', (hex, expected) => {
    expect(luminance(hex)).toBeCloseTo(expected, 4)
  })

  it('takes r, g, b as well as a hex colour', () => {
    expect(luminance(119, 119, 119)).toBeCloseTo(luminance('#777777'), 10)
  })

  it('gives 21 for white on black, in either order', () => {
    expect(contrastRatio(1, 0)).toBeCloseTo(21, 10)
    expect(contrastRatio(0, 1)).toBeCloseTo(21, 10)
  })
})

describe('groundOf [D2 rule 2]', () => {
  const box = { x: 0, y: 0, width: 100, height: 100 }

  it('gives the 10th and 90th percentile over a half-white, half-black picture', () => {
    const pixels = picture(100, 100, (x) => (x < 50 ? WHITE : BLACK))
    expect(groundOf(pixels, box, 1)).toEqual({ dark: 0, light: 1 })
  })

  it('lays a pixel with alpha below 255 over black first', () => {
    const pixels = picture(10, 10, () => [255, 255, 255, 0])
    expect(groundOf(pixels, { x: 0, y: 0, width: 10, height: 10 }, 1)).toEqual({
      dark: 0,
      light: 0,
    })
  })

  it('scales the box into the picture', () => {
    const pixels = picture(50, 50, (x) => (x < 25 ? WHITE : BLACK))
    expect(groundOf(pixels, { x: 0, y: 0, width: 40, height: 100 }, 0.5)).toEqual({
      dark: 1,
      light: 1,
    })
  })

  it('reads only the part of a box inside the picture', () => {
    const pixels = picture(10, 10, (x) => (x < 5 ? BLACK : WHITE))
    expect(groundOf(pixels, { x: 5, y: -20, width: 400, height: 400 }, 1)).toEqual({
      dark: 1,
      light: 1,
    })
  })

  it('gives no ground for a box wholly outside the picture', () => {
    const pixels = picture(10, 10, () => WHITE)
    expect(groundOf(pixels, { x: 20, y: 0, width: 5, height: 5 }, 1)).toBeNull()
  })
})
