import zlib from 'node:zlib'
import { describe, it, expect } from 'vitest'
import { pictureType } from '../../../src/main/providers/picture-type'
import { pictureSize } from '../../../src/main/providers/picture-size'
import { pngChunks } from '../../fixtures/png-chunks'
import { circlePng } from '../../live/shape-picture'

// The RGB value of one pixel, read from the PNG's own data (8-bit RGB, filter 0 on each row).
function pixelAt(bytes: Uint8Array, size: number, x: number, y: number): number[] {
  const idat = Buffer.concat(
    pngChunks(bytes)
      .filter((chunk) => chunk.type === 'IDAT')
      .map((chunk) => chunk.data),
  )
  const raw = zlib.inflateSync(idat)
  const at = y * (size * 3 + 1) + 1 + x * 3
  return [raw[at] ?? -1, raw[at + 1] ?? -1, raw[at + 2] ?? -1]
}

describe('the reference picture the live reference test makes [SPEC 14 1.46, OI-79]', () => {
  it('is a valid PNG of the stated pixel size', () => {
    const bytes = circlePng(512)
    expect(pictureType(bytes)).toBe('image/png')
    expect(pictureSize(bytes, 'image/png')).toEqual({ width: 512, height: 512 })
    expect(pngChunks(bytes).every((chunk) => chunk.crcOk)).toBe(true)
  })

  it('shows a magenta circle in the middle on a white ground', () => {
    const bytes = circlePng(512)
    expect(pixelAt(bytes, 512, 256, 256)).toEqual([0xff, 0x00, 0xff])
    expect(pixelAt(bytes, 512, 2, 2)).toEqual([0xff, 0xff, 0xff])
    expect(pixelAt(bytes, 512, 509, 509)).toEqual([0xff, 0xff, 0xff])
  })
})
