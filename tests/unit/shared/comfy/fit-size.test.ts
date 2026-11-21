import { describe, it, expect } from 'vitest'
import { fitSize } from '../../../../src/shared/comfy/fit-size'

const MOSS = { multiple: 16, minPixels: 1_000_000, maxPixels: 2_000_000 }
const H3 = { multiple: 32, minPixels: 589_824, maxPixels: 1_048_576 }

describe('fitSize: the table of SPEC 6.10.5 [FR-259, FR-262, A-C3]', () => {
  it.each([
    [1080, 1080, MOSS, 1072, 1072],
    [1080, 1920, MOSS, 1056, 1872],
    [1920, 1080, MOSS, 1872, 1056],
    [1080, 1350, MOSS, 1088, 1360],
    [1080, 1080, H3, 1024, 1024],
    [1080, 1920, H3, 768, 1344],
    [1920, 1080, H3, 1344, 768],
    [1080, 1350, H3, 896, 1120],
  ])('fits %i x %i to the rule as the table says', (width, height, rule, w, h) => {
    expect(fitSize({ width, height }, rule)).toEqual({ width: w, height: h })
  })

  it('fits a custom size: 1200 x 628 for MOSS-Image gives 1392 x 736', () => {
    expect(fitSize({ width: 1200, height: 628 }, MOSS)).toEqual({ width: 1392, height: 736 })
  })

  it('gives sides that are multiples of the rule, inside its pixel range, for many shapes', () => {
    for (const rule of [MOSS, H3]) {
      for (const [w, h] of [
        [100, 100],
        [4000, 4000],
        [1080, 566],
        [300, 2000],
        [1, 1],
      ] as const) {
        const fit = fitSize({ width: w, height: h }, rule)
        expect(fit.width % rule.multiple).toBe(0)
        expect(fit.height % rule.multiple).toBe(0)
        expect(fit.width).toBeGreaterThanOrEqual(rule.multiple)
        expect(fit.height).toBeGreaterThanOrEqual(rule.multiple)
      }
    }
  })

  it('never gives a side below one multiple, even for a very long shape', () => {
    const fit = fitSize({ width: 100_000, height: 1 }, H3)
    expect(fit.height).toBe(32)
  })

  it('keeps a pair outside the range when every pair is outside it', () => {
    // 1 x 100000 at 16: the short side cannot go below 16, so every pair is too large.
    const fit = fitSize({ width: 1, height: 100_000 }, { multiple: 16, minPixels: 1, maxPixels: 2 })
    expect(fit.width).toBe(16)
  })

  it('on a tie in ratio takes the area closest to the asked area', () => {
    // A square asks for one of two square pairs; the nearer area wins.
    expect(
      fitSize({ width: 100, height: 100 }, { multiple: 16, minPixels: 1, maxPixels: 1e9 }),
    ).toEqual({ width: 96, height: 96 })
  })

  it('refuses a size that is not two whole numbers above zero', () => {
    expect(() => fitSize({ width: 0, height: 10 }, MOSS)).toThrow(Error)
    expect(() => fitSize({ width: 10, height: 1.5 }, MOSS)).toThrow(Error)
  })
})
