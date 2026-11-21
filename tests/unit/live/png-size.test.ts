import { describe, it, expect } from 'vitest'
import { pngPixelSize } from '../../live/png-size'

// The first 24 bytes of a PNG: signature, IHDR length and type, width and height (big-endian).
function pngHead(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  bytes.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8)
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

describe('pngPixelSize, for the live test output [SPEC 6.2 O-8, G6]', () => {
  it('reads the width and height from the IHDR chunk', () => {
    expect(pngPixelSize(pngHead(1024, 1536))).toEqual({ width: 1024, height: 1536 })
  })

  it('refuses bytes that are not a PNG', () => {
    const bytes = pngHead(1, 1)
    bytes[0] = 0xff
    expect(() => pngPixelSize(bytes)).toThrow('not a PNG')
  })

  it('refuses a PNG too short to hold its size', () => {
    expect(() => pngPixelSize(pngHead(1, 1).slice(0, 20))).toThrow('not a PNG')
  })
})
