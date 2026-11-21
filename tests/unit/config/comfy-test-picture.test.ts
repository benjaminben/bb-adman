import zlib from 'node:zlib'
import { describe, it, expect } from 'vitest'
import { pictureType } from '../../../src/main/providers/picture-type'
import { pictureSize } from '../../../src/main/providers/picture-size'
import { pngChunks } from '../../fixtures/png-chunks'
import { makeTestPicture, TEST_PICTURE_SIDE } from '../../comfy/test-picture'

function pixelAt(bytes: Uint8Array, x: number, y: number): number[] {
  const idat = Buffer.concat(pngChunks(bytes).filter((c) => c.type === 'IDAT').map((c) => c.data))
  const raw = zlib.inflateSync(idat)
  const at = y * (TEST_PICTURE_SIDE * 3 + 1) + 1 + x * 3
  return [raw[at] ?? -1, raw[at + 1] ?? -1, raw[at + 2] ?? -1]
}

describe("the test's own picture [SPEC 14 1.46, CU-5a case 5]", () => {
  it('is a 768 by 768 PNG with good chunks', () => {
    const bytes = makeTestPicture()
    expect(TEST_PICTURE_SIDE).toBe(768)
    expect(pictureType(bytes)).toBe('image/png')
    expect(pictureSize(bytes, 'image/png')).toEqual({ width: 768, height: 768 })
    const chunks = pngChunks(bytes)
    expect(chunks.map((c) => c.type)).toEqual(['IHDR', 'IDAT', 'IEND'])
    expect(chunks.every((c) => c.crcOk)).toBe(true)
  })

  it('holds plain coloured shapes on a light ground', () => {
    const bytes = makeTestPicture()
    expect(pixelAt(bytes, 5, 5)).toEqual([240, 236, 226])
    expect(pixelAt(bytes, 200, 200)).toEqual([214, 48, 49])
    expect(pixelAt(bytes, 540, 540)).toEqual([9, 132, 227])
  })

  it('is the same bytes each time, so the upload name never changes', () => {
    expect(Buffer.from(makeTestPicture()).equals(Buffer.from(makeTestPicture()))).toBe(true)
  })
})
