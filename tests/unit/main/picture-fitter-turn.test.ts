import { describe, it, expect } from 'vitest'
import { pictureFitter } from '@/main/picture-fitter'
import { bitmapTurner } from '@/main/image-turner'
import { PICTURE_NOT_DECODED } from '@/main/png-converter'
import { bands, fakeImage, readFake, type Calls, type Grid } from './picture-fitter-fake'
import { gridOf, orientedJpegHead } from './oriented-jpeg'

const RED = 1
const GREEN = 2

// The grid fake from the fitter's tests, with the bitmap the turner reads.
function withBitmap(grid: Grid, calls: Calls) {
  const bitmap = () => Buffer.from(grid.flat().flatMap((c) => [c, c, c, c]))
  return { ...fakeImage(grid, calls), toBitmap: bitmap }
}

function allOf(rows: Grid, colour: number): boolean {
  return rows.every((row) => row.every((pixel) => pixel === colour))
}

function setup(grid: Grid) {
  const calls: Calls = { decode: 0, crops: [], resizes: [] }
  const decode = (_buffer: Buffer) => withBitmap(grid, calls)
  const turn = bitmapTurner((data, size) => withBitmap(gridOf(data, size), calls))
  return { calls, fitPicture: pictureFitter(decode, turn) }
}

describe('pictureFitter turns a JPEG by its orientation tag before it crops [EX-1, A-55]', () => {
  // Stored 40 wide and 20 tall: red on the left half, green on the right. Tag 6 turns it a
  // quarter clockwise to 20 x 40, so red is on top. A 20 x 20 run keeps the centre square.
  const stored = Array.from({ length: 20 }, () => [
    ...Array<number>(20).fill(RED),
    ...Array<number>(20).fill(GREEN),
  ])

  it('crops the turned picture, not the stored one', () => {
    const { calls, fitPicture } = setup(stored)
    const out = readFake(fitPicture(orientedJpegHead(40, 20, 6), { width: 20, height: 40 }))
    expect(calls.crops).toEqual([])
    expect([out.width, out.height]).toEqual([20, 40])
    expect(allOf(out.grid.slice(0, 20), RED)).toBe(true)
    expect(allOf(out.grid.slice(20), GREEN)).toBe(true)
  })

  it('crops a tag-8 picture top and bottom, as a tall picture', () => {
    const { calls, fitPicture } = setup(stored)
    fitPicture(orientedJpegHead(40, 20, 8), { width: 10, height: 10 })
    expect(calls.crops).toEqual([{ x: 0, y: 10, width: 20, height: 20 }])
  })

  it('does not turn a tag-1 JPEG', () => {
    const { calls, fitPicture } = setup(bands(40, [[RED, 20]]))
    fitPicture(orientedJpegHead(40, 20, 1), { width: 10, height: 10 })
    expect(calls.crops).toEqual([{ x: 10, y: 0, width: 20, height: 20 }])
  })

  it('refuses with the fixed message when a turn fails', () => {
    const calls: Calls = { decode: 0, crops: [], resizes: [] }
    const decode = (_buffer: Buffer) => withBitmap(stored, calls)
    const fitPicture = pictureFitter(decode, () => {
      throw new Error('a decoder message')
    })
    const run = () => fitPicture(orientedJpegHead(40, 20, 6), { width: 10, height: 10 })
    expect(run).toThrow(new Error(PICTURE_NOT_DECODED))
  })
})
