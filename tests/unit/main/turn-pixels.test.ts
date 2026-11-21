import { describe, it, expect } from 'vitest'
import { turnPixels } from '@/main/turn-pixels'
import type { Orientation } from '@/main/jpeg-orientation'

// A 3 x 2 picture, four bytes a pixel. Each pixel's four bytes are its own number, so the
// turned picture can be read back as a grid of numbers. Pixel 1 is the marked top-left corner.
//   1 2 3
//   4 5 6
const WIDTH = 3
const HEIGHT = 2
const PIXELS = new Uint8Array([1, 2, 3, 4, 5, 6].flatMap((n) => [n, n, n, n]))

function grid(data: Uint8Array, width: number): number[][] {
  const numbers = Array.from({ length: data.length / 4 }, (_, i) => data[i * 4] ?? 0)
  const rows: number[][] = []
  for (let at = 0; at < numbers.length; at += width) rows.push(numbers.slice(at, at + width))
  return rows
}

describe('turnPixels turns and mirrors by the orientation tag [EX-1]', () => {
  const table: Array<[Orientation, string, number[][]]> = [
    [
      1,
      'as it is',
      [
        [1, 2, 3],
        [4, 5, 6],
      ],
    ],
    [
      2,
      'mirrored left to right',
      [
        [3, 2, 1],
        [6, 5, 4],
      ],
    ],
    [
      3,
      'turned half way',
      [
        [6, 5, 4],
        [3, 2, 1],
      ],
    ],
    [
      4,
      'mirrored top to bottom',
      [
        [4, 5, 6],
        [1, 2, 3],
      ],
    ],
    [
      5,
      'mirrored across the top-left diagonal',
      [
        [1, 4],
        [2, 5],
        [3, 6],
      ],
    ],
    [
      6,
      'turned a quarter clockwise',
      [
        [4, 1],
        [5, 2],
        [6, 3],
      ],
    ],
    [
      7,
      'mirrored across the other diagonal',
      [
        [6, 3],
        [5, 2],
        [4, 1],
      ],
    ],
    [
      8,
      'turned a quarter anticlockwise',
      [
        [3, 6],
        [2, 5],
        [1, 4],
      ],
    ],
  ]
  for (const [tag, what, expected] of table) {
    it(`tag ${tag}: the picture is ${what}`, () => {
      const out = turnPixels(PIXELS, { width: WIDTH, height: HEIGHT }, tag)
      const swapped = tag >= 5
      expect(out.width).toBe(swapped ? HEIGHT : WIDTH)
      expect(out.height).toBe(swapped ? WIDTH : HEIGHT)
      expect(out.data.length).toBe(PIXELS.length)
      expect(grid(out.data, out.width)).toEqual(expected)
    })
  }

  it('keeps all four bytes of each pixel together', () => {
    const data = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80])
    const out = turnPixels(data, { width: 2, height: 1 }, 6)
    expect([...out.data]).toEqual([10, 20, 30, 40, 50, 60, 70, 80])
    expect([out.width, out.height]).toEqual([1, 2])
  })

  it('never changes the pixels it was given', () => {
    const copy = new Uint8Array(PIXELS)
    turnPixels(PIXELS, { width: WIDTH, height: HEIGHT }, 3)
    expect(PIXELS).toEqual(copy)
  })
})
