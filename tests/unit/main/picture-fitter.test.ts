import { describe, it, expect } from 'vitest'
import { pictureFitter } from '@/main/picture-fitter'
import { bands, columns, gridDecoder, jpegHead, pngHead, readFake } from './picture-fitter-fake'

const RED = 1
const GREEN = 2
const BLUE = 3

function allOf(grid: number[][], colour: number): boolean {
  return grid.every((row) => row.every((pixel) => pixel === colour))
}

describe('pictureFitter crops, then scales, never stretches [SPEC 6.10.7 1.60, 14 N-2, FR-286]', () => {
  it('cuts 200 px off the top and the bottom of a 1200 x 1600 picture for a 576 x 576 run', () => {
    const grid = bands(1200, [
      [RED, 200],
      [GREEN, 1200],
      [BLUE, 200],
    ])
    const { calls, decode } = gridDecoder(grid)
    const out = readFake(pictureFitter(decode)(pngHead(1200, 1600), { width: 576, height: 576 }))
    expect(calls.crops).toEqual([{ x: 0, y: 200, width: 1200, height: 1200 }])
    expect(calls.resizes).toEqual([{ width: 576, height: 576, quality: 'best' }])
    expect([out.width, out.height]).toEqual([576, 576])
    expect(allOf(out.grid, GREEN)).toBe(true)
  })

  it('cuts the sides off a wide picture, keeping the centre', () => {
    const grid = columns(100, [
      [RED, 100],
      [GREEN, 100],
      [BLUE, 100],
    ])
    const { calls, decode } = gridDecoder(grid)
    const out = readFake(pictureFitter(decode)(pngHead(300, 100), { width: 80, height: 80 }))
    expect(calls.crops).toEqual([{ x: 100, y: 0, width: 100, height: 100 }])
    expect([out.width, out.height]).toEqual([80, 80])
    expect(allOf(out.grid, GREEN)).toBe(true)
  })

  it('cuts a square picture to a wide run, rounding the side to whole pixels', () => {
    const grid = bands(100, [
      [RED, 22],
      [GREEN, 56],
      [BLUE, 22],
    ])
    const { calls, decode } = gridDecoder(grid)
    const out = readFake(pictureFitter(decode)(jpegHead(100, 100), { width: 160, height: 90 }))
    expect(calls.crops).toEqual([{ x: 0, y: 22, width: 100, height: 56 }])
    expect(calls.resizes).toEqual([{ width: 160, height: 90, quality: 'best' }])
    expect([out.width, out.height]).toEqual([160, 90])
    expect(allOf(out.grid, GREEN)).toBe(true)
  })

  it('keeps all of a square picture for a square run', () => {
    const { calls, decode } = gridDecoder(bands(40, [[GREEN, 40]]))
    const out = readFake(pictureFitter(decode)(pngHead(40, 40), { width: 20, height: 20 }))
    expect(calls.crops).toEqual([])
    expect(calls.resizes).toEqual([{ width: 20, height: 20, quality: 'best' }])
    expect([out.width, out.height]).toEqual([20, 20])
  })

  it('only re-encodes a picture that is already the exact run size', () => {
    const grid = bands(64, [
      [RED, 16],
      [GREEN, 16],
      [BLUE, 16],
    ])
    const { calls, decode } = gridDecoder(grid)
    const out = readFake(pictureFitter(decode)(pngHead(64, 48), { width: 64, height: 48 }))
    expect(calls.crops).toEqual([])
    expect(calls.resizes).toEqual([])
    expect(out.grid).toEqual(grid)
  })

  it('scales up a picture smaller than the run', () => {
    const { decode } = gridDecoder(bands(50, [[GREEN, 50]]))
    const out = readFake(pictureFitter(decode)(pngHead(50, 50), { width: 100, height: 100 }))
    expect([out.width, out.height]).toEqual([100, 100])
    expect(allOf(out.grid, GREEN)).toBe(true)
  })

  it('returns a Uint8Array', () => {
    const { decode } = gridDecoder(bands(4, [[GREEN, 4]]))
    expect(pictureFitter(decode)(pngHead(4, 4), { width: 2, height: 2 })).toBeInstanceOf(Uint8Array)
  })
})
