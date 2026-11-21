// P8-4: the tiles a full-size draw asks for (spec/phases/phase-08.md "Drawing at full size").
import { describe, it, expect } from 'vitest'
import { tilePlan } from '@/main/thumbnails/tiles'

describe('tilePlan [P8-4, A-190]', () => {
  it.each([
    [1080, 1080, 1],
    [2048, 2048, 1],
    [2049, 100, 2],
    [4000, 1000, 2],
    [8192, 8192, 16],
  ])('splits %i x %i into %i tiles of at most 2,048 a side', (width, height, count) => {
    const tiles = tilePlan(width, height, 2048)
    expect(tiles).toHaveLength(count)
    for (const t of tiles) {
      expect(t.width).toBeGreaterThan(0)
      expect(t.height).toBeGreaterThan(0)
      expect(t.width).toBeLessThanOrEqual(2048)
      expect(t.height).toBeLessThanOrEqual(2048)
    }
  })

  it.each([
    [1080, 1080],
    [2049, 100],
    [3000, 4100],
    [8192, 8192],
  ])('covers every pixel of %i x %i exactly once', (width, height) => {
    const seen = new Uint8Array(width * height)
    for (const t of tilePlan(width, height, 2048)) {
      for (let y = t.y; y < t.y + t.height; y++) {
        for (let x = t.x; x < t.x + t.width; x++)
          seen[y * width + x] = (seen[y * width + x] ?? 0) + 1
      }
    }
    expect(seen.every((n) => n === 1)).toBe(true)
  })

  it('goes left to right, then top to bottom', () => {
    expect(tilePlan(3000, 2100, 2048)).toEqual([
      { x: 0, y: 0, width: 2048, height: 2048 },
      { x: 2048, y: 0, width: 952, height: 2048 },
      { x: 0, y: 2048, width: 2048, height: 52 },
      { x: 2048, y: 2048, width: 952, height: 52 },
    ])
  })

  it.each([
    [0, 10],
    [10, -1],
    [10.5, 10],
    [10, 10, 0],
  ])('refuses a size or limit that is not a positive whole number (%s, %s)', (w, h, max = 2048) => {
    expect(() => tilePlan(w, h, max)).toThrow()
  })
})
