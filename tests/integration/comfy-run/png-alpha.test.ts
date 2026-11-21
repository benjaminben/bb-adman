// P4-9 case 8's PNG reader: it undoes all five row filters and counts see-through pixels.
import zlib from 'node:zlib'
import { describe, it, expect } from 'vitest'
import { countAlpha, pngColourType } from '../../comfy/png-alpha'
import { greyPng } from '@/main/providers/fake/png'

const W = 5
const H = 5
const BPP = 4

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)]
  if (pa <= pb && pa <= pc) return a
  return pb <= pc ? b : c
}

// Row y is written with filter y (0 none, 1 sub, 2 up, 3 average, 4 paeth).
function filteredPng(rows: number[][]): Uint8Array {
  const stride = W * BPP
  const raw: number[] = []
  rows.forEach((row, y) => {
    raw.push(y)
    for (let x = 0; x < stride; x++) {
      const a = x >= BPP ? (row[x - BPP] ?? 0) : 0
      const b = y > 0 ? (rows[y - 1]?.[x] ?? 0) : 0
      const c = x >= BPP && y > 0 ? (rows[y - 1]?.[x - BPP] ?? 0) : 0
      const guess = [0, a, b, (a + b) >> 1, paeth(a, b, c)][y] ?? 0
      raw.push(((row[x] ?? 0) - guess) & 0xff)
    }
  })
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(8)
    head.writeUInt32BE(data.length, 0)
    head.write(type, 4, 'ascii')
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(zlib.crc32(Buffer.concat([head.subarray(4), data])), 0)
    return Buffer.concat([head, data, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0)
  ihdr.writeUInt32BE(H, 4)
  ihdr.set([8, 6, 0, 0, 0], 8)
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const idat = chunk('IDAT', zlib.deflateSync(Buffer.from(raw)))
  return new Uint8Array(
    Buffer.concat([signature, chunk('IHDR', ihdr), idat, chunk('IEND', Buffer.alloc(0))]),
  )
}

describe('the case 8 PNG reader [P4-9]', () => {
  it('undoes every row filter and counts clear and partly see-through pixels', () => {
    // Alpha per pixel: 0 on the diagonal, 100 just right of it, 255 elsewhere.
    const alpha = (x: number, y: number) => (x === y ? 0 : x === y + 1 ? 100 : 255)
    const rows = Array.from({ length: H }, (_, y) =>
      Array.from({ length: W }, (_, x) => [x * 40, y * 50, (x + y) * 20, alpha(x, y)]).flat(),
    )
    expect(countAlpha(filteredPng(rows))).toEqual({ pixels: 25, clear: 5, partly: 4 })
  })

  it('gives the colour type, and no count for a PNG without alpha', () => {
    expect(pngColourType(greyPng(3, 3))).toBe(0)
    expect(countAlpha(greyPng(3, 3))).toBeNull()
    expect(pngColourType(new Uint8Array([1, 2, 3]))).toBeNull()
  })
})
