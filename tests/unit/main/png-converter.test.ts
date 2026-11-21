import { describe, it, expect } from 'vitest'
import { PICTURE_NOT_DECODED, pngConverter } from '../../../src/main/png-converter'
import { MAX_PICTURE_BYTES, MAX_PICTURE_SIDE } from '../../../src/main/providers/picture-limits'

// [1.21] L7: a hand-made JPEG start whose frame header (FFC0) states 1 x 1.
const SMALL_JPEG = [0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 1, 1, 0x11, 0]

// A stand-in for Electron's nativeImage.createFromBuffer.
function decoder(empty: boolean, png: number[]) {
  const seen: Buffer[] = []
  const decode = (buffer: Buffer) => {
    seen.push(buffer)
    return { isEmpty: () => empty, toPNG: () => Buffer.from(png) }
  }
  return { seen, decode }
}

describe('pngConverter, the toPng index.ts hands createCore [SPEC 6.2 1.18, K3]', () => {
  it('decodes the bytes and returns the PNG the decoder gives', () => {
    const { seen, decode } = decoder(false, [0x89, 0x50])
    const png = pngConverter(decode)(new Uint8Array(SMALL_JPEG))
    expect(png).toBeInstanceOf(Uint8Array)
    expect([...png]).toEqual([0x89, 0x50])
    expect(seen.map((b) => [...b])).toEqual([SMALL_JPEG])
  })

  it('throws a plain Error with the fixed message when the picture cannot be decoded', () => {
    const { decode } = decoder(true, [])
    const run = () => pngConverter(decode)(new Uint8Array(SMALL_JPEG))
    expect(run).toThrow(Error)
    expect(run).toThrow(new Error(PICTURE_NOT_DECODED))
  })
})

// A decoder that records each call and gives a picture of the given PNG bytes.
function countingDecoder(png: number[] = [0x89, 0x50]) {
  const calls = { count: 0 }
  const decode = (_buffer: Buffer) => {
    calls.count += 1
    return { isEmpty: () => false, toPNG: () => Buffer.from(png) }
  }
  return { calls, decode }
}

describe('pngConverter refuses before decoding [SPEC 6.2 1.20, 14 L2]', () => {
  it('refuses more than MAX_PICTURE_BYTES and never calls decode', () => {
    const { calls, decode } = countingDecoder()
    const bytes = new Uint8Array(MAX_PICTURE_BYTES + 1)
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(() => pngConverter(decode)(bytes)).toThrow(new Error(PICTURE_NOT_DECODED))
    expect(calls.count).toBe(0)
  })

  it('refuses a GIF and never calls decode', () => {
    const { calls, decode } = countingDecoder()
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0, 0, 0])
    expect(() => pngConverter(decode)(gif)).toThrow(new Error(PICTURE_NOT_DECODED))
    expect(calls.count).toBe(0)
  })

  it('still refuses a picture the decoder finds empty', () => {
    const { seen, decode } = decoder(true, [0x89, 0x50])
    const run = () => pngConverter(decode)(new Uint8Array(SMALL_JPEG))
    expect(run).toThrow(new Error(PICTURE_NOT_DECODED))
    expect(seen).toHaveLength(1)
  })

  it('throws when the decoder gives a PNG of zero bytes', () => {
    const { calls, decode } = countingDecoder([])
    const run = () => pngConverter(decode)(new Uint8Array(SMALL_JPEG))
    expect(run).toThrow(new Error(PICTURE_NOT_DECODED))
    expect(calls.count).toBe(1)
  })
})

// A PNG head: signature, IHDR length and type, width and height (big-endian).
function pngHead(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  bytes.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8)
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

// A JPEG start: the start marker, then a frame header (FFC0) with height and width.
function jpegHead(width: number, height: number): Uint8Array {
  return new Uint8Array([
    ...[0xff, 0xd8],
    ...[0xff, 0xc0, 0x00, 0x0b, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff],
    ...[0x01, 0x01, 0x11, 0x00],
  ])
}

describe('pngConverter refuses a stated size over the limits [SPEC 6.2 1.21, 14 L7]', () => {
  const refused: Array<[string, Uint8Array]> = [
    ['a PNG header stating 9,000 x 100', pngHead(9000, 100)],
    ['a PNG header stating 6,000 x 6,000', pngHead(6000, 6000)],
    ['a PNG header stating a side of 0', pngHead(0, 100)],
    ['a JPEG frame header stating 9,000 x 100', jpegHead(9000, 100)],
    ['a JPEG frame header stating 6,000 x 6,000', jpegHead(6000, 6000)],
    ['bytes with a PNG signature and no readable header', pngHead(1, 1).slice(0, 12)],
    ['bytes with a JPEG start and no frame header', new Uint8Array([0xff, 0xd8, 0xff])],
  ]
  for (const [what, bytes] of refused) {
    it(`refuses ${what} and never calls decode`, () => {
      const { calls, decode } = countingDecoder()
      expect(() => pngConverter(decode)(bytes)).toThrow(new Error(PICTURE_NOT_DECODED))
      expect(calls.count).toBe(0)
    })
  }

  it('decodes a PNG at the side limit and a JPEG within the pixel limit', () => {
    const { calls, decode } = countingDecoder()
    pngConverter(decode)(pngHead(MAX_PICTURE_SIDE, 100))
    pngConverter(decode)(jpegHead(4000, 6000))
    expect(calls.count).toBe(2)
  })
})
