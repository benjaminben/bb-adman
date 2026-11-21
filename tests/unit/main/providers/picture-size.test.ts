import fs from 'node:fs'
import { describe, it, expect } from 'vitest'
import { pictureSize } from '../../../../src/main/providers/picture-size'

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

// A JPEG head: start marker, an APP0 segment, a Huffman table segment (FFC4, not a frame),
// then a frame header of the given marker with height and width (big-endian).
function jpegHead(width: number, height: number, frame = 0xc0): Uint8Array {
  return new Uint8Array([
    ...[0xff, 0xd8],
    ...[0xff, 0xe0, 0x00, 0x06, 0x4a, 0x46, 0x49, 0x46],
    ...[0xff, 0xc4, 0x00, 0x04, 0x00, 0x00],
    ...[0xff, frame, 0x00, 0x0b, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff],
    ...[0x01, 0x01, 0x11, 0x00],
  ])
}

describe('pictureSize, for the live test output [SPEC 6.2 1.18, K4]', () => {
  it('reads a PNG size from the IHDR chunk', () => {
    expect(pictureSize(pngHead(1024, 1536), 'image/png')).toEqual({ width: 1024, height: 1536 })
  })

  it('reads a JPEG size from the frame header, past other segments', () => {
    expect(pictureSize(jpegHead(1024, 1536), 'image/jpeg')).toEqual({ width: 1024, height: 1536 })
  })

  it('reads the 1x1 size of the hand-made JPEG fixture', () => {
    const url = new URL(
      '../../../fixtures/providers/gemini/image-success-jpeg.json',
      import.meta.url,
    )
    const body = JSON.parse(fs.readFileSync(url, 'utf8')) as {
      candidates: Array<{ content: { parts: Array<{ inlineData?: { data: string } }> } }>
    }
    const data = body.candidates[0]?.content.parts[1]?.inlineData?.data ?? ''
    const bytes = new Uint8Array(Buffer.from(data, 'base64'))
    expect(pictureSize(bytes, 'image/jpeg')).toEqual({ width: 1, height: 1 })
  })

  it('reads a progressive JPEG frame header (FFC2) too', () => {
    expect(pictureSize(jpegHead(800, 600, 0xc2), 'image/jpeg')).toEqual({ width: 800, height: 600 })
  })

  it('refuses a JPEG with no frame header before the end', () => {
    const head = jpegHead(1, 1)
    expect(() => pictureSize(head.slice(0, 14), 'image/jpeg')).toThrow('not a JPEG')
  })

  it('refuses bytes that do not start like a JPEG', () => {
    const bytes = jpegHead(1, 1)
    bytes[1] = 0x00
    expect(() => pictureSize(bytes, 'image/jpeg')).toThrow('not a JPEG')
  })

  it('refuses a PNG that is not a PNG', () => {
    expect(() => pictureSize(jpegHead(1, 1), 'image/png')).toThrow('not a PNG')
  })
})
