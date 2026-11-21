import { describe, it, expect } from 'vitest'
import { PICTURE_NOT_DECODED, pngConverter } from '../../../src/main/png-converter'

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
