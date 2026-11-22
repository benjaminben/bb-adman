// R2E-4 (spec/phases/round-2-editor.md D4, "Same shape"): a picture whose width-to-height
// ratio is within 1% of the layer box's, either way.
import { describe, it, expect } from 'vitest'
import { sameShape } from '@/shared/generation/same-shape'

const BOX = { width: 1000, height: 500 }

describe('sameShape [R2E-4, D4]', () => {
  it.each([
    ['the exact ratio', 2000, 1000, true],
    ['1% wider', 2020, 1000, true],
    ['1% narrower', 1980, 1000, true],
    ['just past 1% wider', 2021, 1000, false],
    ['just past 1% narrower', 1979, 1000, false],
    ['a square', 1000, 1000, false],
    ['the box turned on its side', 500, 1000, false],
  ])('%s', (_name, width, height, same) => {
    expect(sameShape(BOX, { width, height })).toBe(same)
  })

  it.each([
    ['a picture of no width', { width: 0, height: 500 }, BOX],
    ['a picture of no height', { width: 1000, height: 0 }, BOX],
    ['a picture of unknown size', { width: null, height: null }, BOX],
    ['a box of no height', BOX, { width: 1000, height: 0 }],
    ['a box of no width', BOX, { width: 0, height: 500 }],
  ])('is never the same shape for %s', (_name, picture, box) => {
    expect(sameShape(box, picture)).toBe(false)
  })
})
