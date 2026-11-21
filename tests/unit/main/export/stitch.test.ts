// P8-4: the pure byte copy that joins tile bitmaps into one (spec/phases/phase-08.md
// "Drawing at full size").
import { describe, it, expect } from 'vitest'
import { stitchBitmaps } from '@/main/export/stitch'

// A 3 x 2 tile whose every pixel holds its tile number and its place in the joined picture.
function tile(n: number, x0: number, y0: number) {
  const data = new Uint8Array(3 * 2 * 4)
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 3; x++) data.set([n, x0 + x, y0 + y, 255], (y * 3 + x) * 4)
  }
  return { x: x0, y: y0, width: 3, height: 2, data }
}

describe('stitchBitmaps [P8-4]', () => {
  it('joins 2 x 2 tiles of 3 x 2 pixels into one 6 x 4 bitmap', () => {
    const parts = [tile(1, 0, 0), tile(2, 3, 0), tile(3, 0, 2), tile(4, 3, 2)]
    const out = stitchBitmaps(parts, { width: 6, height: 4 })
    expect(out).toHaveLength(6 * 4 * 4)
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 6; x++) {
        const n = 1 + (x >= 3 ? 1 : 0) + (y >= 2 ? 2 : 0)
        expect([...out.subarray((y * 6 + x) * 4, (y * 6 + x) * 4 + 4)]).toEqual([n, x, y, 255])
      }
    }
  })

  it('refuses a tile that reaches outside the picture', () => {
    expect(() => stitchBitmaps([tile(1, 4, 0)], { width: 6, height: 4 })).toThrow()
    expect(() => stitchBitmaps([tile(1, 0, 3)], { width: 6, height: 4 })).toThrow()
    expect(() => stitchBitmaps([tile(1, -1, 0)], { width: 6, height: 4 })).toThrow()
  })

  it('refuses a tile whose bytes do not match its size', () => {
    const bad = { ...tile(1, 0, 0), width: 2 }
    expect(() => stitchBitmaps([bad], { width: 6, height: 4 })).toThrow()
  })
})
