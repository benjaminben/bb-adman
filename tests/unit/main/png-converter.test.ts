import { describe, it, expect } from 'vitest'
import { PICTURE_NOT_DECODED, pngConverter } from '../../../src/main/png-converter'
import { MAX_PICTURE_BYTES } from '../../../src/main/providers/picture-limits'

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
    const png = pngConverter(decode)(new Uint8Array([0xff, 0xd8, 0xff]))
    expect(png).toBeInstanceOf(Uint8Array)
    expect([...png]).toEqual([0x89, 0x50])
    expect(seen.map((b) => [...b])).toEqual([[0xff, 0xd8, 0xff]])
  })

  it('throws a plain Error with the fixed message when the picture cannot be decoded', () => {
    const { decode } = decoder(true, [])
    const run = () => pngConverter(decode)(new Uint8Array([1, 2, 3]))
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
    const run = () => pngConverter(decode)(new Uint8Array([0xff, 0xd8, 0xff]))
    expect(run).toThrow(new Error(PICTURE_NOT_DECODED))
    expect(seen).toHaveLength(1)
  })

  it('throws when the decoder gives a PNG of zero bytes', () => {
    const { calls, decode } = countingDecoder([])
    const run = () => pngConverter(decode)(new Uint8Array([0xff, 0xd8, 0xff]))
    expect(run).toThrow(new Error(PICTURE_NOT_DECODED))
    expect(calls.count).toBe(1)
  })
})
