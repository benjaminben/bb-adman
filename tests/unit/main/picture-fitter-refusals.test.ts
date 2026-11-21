import { describe, it, expect } from 'vitest'
import { PICTURE_NOT_DECODED } from '@/main/png-converter'
import { pictureFitter } from '@/main/picture-fitter'
import { MAX_PICTURE_BYTES, MAX_PICTURE_SIDE } from '@/main/providers/picture-limits'
import { bands, fakeImage, gridDecoder, jpegHead, pngHead } from './picture-fitter-fake'

const RUN = { width: 576, height: 576 }
const REFUSED = new Error(PICTURE_NOT_DECODED)

function tooLarge(): Uint8Array {
  const bytes = new Uint8Array(MAX_PICTURE_BYTES + 1)
  bytes.set(pngHead(10, 10))
  return bytes
}

describe('pictureFitter refuses before decoding [SPEC 14 1.60 N-1, N-3]', () => {
  const refused: Array<[string, Uint8Array]> = [
    ['more than MAX_PICTURE_BYTES', tooLarge()],
    ['a GIF', new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0, 0, 0])],
    ['bytes that are not a picture', new TextEncoder().encode('/Users/someone/photo.png')],
    ['no bytes at all', new Uint8Array(0)],
    ['a PNG header stating 9,000 x 100', pngHead(9000, 100)],
    ['a PNG header stating 6,000 x 6,000', pngHead(6000, 6000)],
    ['a PNG header stating a side of 0', pngHead(0, 100)],
    ['a JPEG frame header stating 100 x 0', jpegHead(100, 0)],
    ['a JPEG frame header stating 6,000 x 6,000', jpegHead(6000, 6000)],
    ['a PNG signature with no readable header', pngHead(1, 1).slice(0, 12)],
    ['a JPEG start with no frame header', new Uint8Array([0xff, 0xd8, 0xff])],
  ]
  for (const [what, bytes] of refused) {
    it(`refuses ${what} with the fixed error and never calls decode`, () => {
      const { calls, decode } = gridDecoder(bands(10, [[1, 10]]))
      expect(() => pictureFitter(decode)(bytes, RUN)).toThrow(REFUSED)
      expect(calls.decode).toBe(0)
    })
  }

  it('decodes a PNG at the side limit', () => {
    const { calls, decode } = gridDecoder(bands(4, [[1, 4]]))
    pictureFitter(decode)(pngHead(MAX_PICTURE_SIDE, 100), RUN)
    expect(calls.decode).toBe(1)
  })

  const badSizes: Array<[string, { width: number; height: number }]> = [
    ['a width of 0', { width: 0, height: 576 }],
    ['a negative height', { width: 576, height: -1 }],
    ['a side that is not a whole number', { width: 576.5, height: 576 }],
    ['a side over MAX_PICTURE_SIDE', { width: MAX_PICTURE_SIDE + 1, height: 576 }],
  ]
  for (const [what, size] of badSizes) {
    it(`refuses a run size with ${what} and never calls decode`, () => {
      const { calls, decode } = gridDecoder(bands(10, [[1, 10]]))
      expect(() => pictureFitter(decode)(pngHead(10, 10), size)).toThrow(REFUSED)
      expect(calls.decode).toBe(0)
    })
  }
})

describe('pictureFitter refuses after decoding [SPEC 14 1.60 N-1]', () => {
  it('refuses a picture the decoder finds empty', () => {
    const { calls, decode } = gridDecoder([])
    expect(() => pictureFitter(decode)(pngHead(10, 10), RUN)).toThrow(REFUSED)
    expect(calls.decode).toBe(1)
    expect(calls.crops).toEqual([])
  })

  it('refuses when the encoder gives a PNG of zero bytes', () => {
    const calls = { decode: 0, crops: [], resizes: [] }
    const decode = () => ({ ...fakeImage(bands(4, [[1, 4]]), calls), toPNG: () => Buffer.alloc(0) })
    expect(() => pictureFitter(decode)(pngHead(4, 4), { width: 4, height: 4 })).toThrow(REFUSED)
  })

  it('names no path, file name or decoder text in its error', () => {
    const decode = () => {
      throw new Error('libpng: bad IHDR in /Users/someone/secret.png')
    }
    let message = ''
    try {
      pictureFitter(decode)(pngHead(10, 10), RUN)
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toBe(PICTURE_NOT_DECODED)
  })
})
