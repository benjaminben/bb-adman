import { describe, it, expect } from 'vitest'
import { nearestAspectRatio } from '../../../../../src/main/providers/gemini/aspect-ratio'

describe('nearestAspectRatio [SPEC 6.2, slice E]', () => {
  it.each([
    [1080, 1080, '1:1'],
    [1080, 1920, '9:16'],
    [1920, 1080, '16:9'],
    [1080, 1350, '4:5'],
    [1200, 628, '16:9'],
    [3000, 1000, '21:9'],
    [1000, 5000, '9:16'],
  ])('picks the nearest supported ratio for %i x %i', (width, height, ratio) => {
    expect(nearestAspectRatio(width, height)).toBe(ratio)
  })
})
