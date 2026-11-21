import { describe, it, expect } from 'vitest'
import { PICTURE_NOT_DECODED, pngConverter } from '@/main/png-converter'
import { bitmapTurner } from '@/main/image-turner'
import { MAX_PICTURE_SIDE } from '@/main/providers/picture-limits'
import { bitmapImage, gridOf, orientedJpegHead } from './oriented-jpeg'
import { pngHead, readFake } from './picture-fitter-fake'

// A 3 x 2 picture with the marked corner (9) at the top left.
const STORED = [
  [9, 0, 0],
  [0, 0, 0],
]

// A stand-in decoder giving STORED, and the turner index.ts builds, over the stand-in.
function setup(grid: number[][] = STORED) {
  const made: Array<{ width: number; height: number }> = []
  const decode = (_buffer: Buffer) => bitmapImage(grid)
  const turn = bitmapTurner((data, size) => {
    made.push(size)
    return bitmapImage(gridOf(data, size))
  })
  return { made, toPng: pngConverter(decode, turn) }
}

describe('toPng turns a JPEG by its orientation tag before it encodes [EX-1, A-55]', () => {
  it('turns a tag-6 JPEG a quarter clockwise: the size swaps and the corner moves', () => {
    const { made, toPng } = setup()
    const out = readFake(toPng(orientedJpegHead(3, 2, 6)))
    expect(made).toEqual([{ width: 2, height: 3 }])
    expect([out.width, out.height]).toEqual([2, 3])
    expect(out.grid).toEqual([
      [0, 9],
      [0, 0],
      [0, 0],
    ])
  })

  it('leaves a tag-1 JPEG and a PNG as decoded and never turns them', () => {
    const { made, toPng } = setup()
    expect(readFake(toPng(orientedJpegHead(3, 2, 1))).grid).toEqual(STORED)
    expect(readFake(toPng(pngHead(3, 2))).grid).toEqual(STORED)
    expect(made).toEqual([])
  })

  it('refuses a picture over the side limit before decoding, whatever its tag', () => {
    const { made, toPng } = setup()
    const bytes = orientedJpegHead(MAX_PICTURE_SIDE + 1, 10, 6)
    expect(() => toPng(bytes)).toThrow(new Error(PICTURE_NOT_DECODED))
    expect(made).toEqual([])
  })

  it('refuses with the fixed message when the bitmap does not match the size', () => {
    const decode = (_buffer: Buffer) => ({
      ...bitmapImage(STORED),
      toBitmap: () => Buffer.alloc(3),
    })
    const toPng = pngConverter(
      decode,
      bitmapTurner(() => bitmapImage(STORED)),
    )
    expect(() => toPng(orientedJpegHead(3, 2, 6))).toThrow(new Error(PICTURE_NOT_DECODED))
  })

  it('refuses a turned JPEG when no turner was given, rather than send it on its side', () => {
    const toPng = pngConverter((_buffer: Buffer) => bitmapImage(STORED))
    expect(() => toPng(orientedJpegHead(3, 2, 8))).toThrow(new Error(PICTURE_NOT_DECODED))
  })
})
