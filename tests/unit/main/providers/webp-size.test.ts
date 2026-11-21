import { describe, it, expect } from 'vitest'
import { webpInfo } from '@/main/providers/webp-size'
import { chunk, vp8, vp8l, vp8x, webp } from '../../../fixtures/webp-bytes'

describe('webpInfo reads the size from the RIFF header [Slice WP]', () => {
  it.each([
    ['a lossy VP8 frame', webp(vp8(640, 480)), { width: 640, height: 480, animated: false }],
    ['a lossless VP8L frame', webp(vp8l(16384, 1)), { width: 16384, height: 1, animated: false }],
    [
      'a still VP8X header',
      webp(vp8x(3000, 2000, false)),
      { width: 3000, height: 2000, animated: false },
    ],
    [
      'an animated VP8X header',
      webp(vp8x(20, 10, true)),
      { width: 20, height: 10, animated: true },
    ],
  ])('%s', (_name, bytes, info) => {
    expect(webpInfo(bytes)).toEqual(info)
  })

  it('reads a file with more bytes after the first chunk', () => {
    const bytes = webp([...vp8x(20, 10, true), ...chunk('ANIM', [0, 0, 0, 0, 0, 0])])
    expect(webpInfo(bytes)).toEqual({ width: 20, height: 10, animated: true })
  })

  const whole = webp(vp8(8, 8))
  it.each([
    ['bytes that are not a RIFF file', new Uint8Array([...whole].fill(0, 0, 4))],
    ['a RIFF file that is not a WebP', new Uint8Array([...whole].fill(0x41, 8, 12))],
    ['a file cut off inside the first chunk', whole.slice(0, whole.length - 1)],
    ['a file cut off inside the RIFF header', whole.slice(0, 10)],
    ['a RIFF size past the end of the file', webp(vp8(8, 8), 1000)],
    ['a zero width', webp(vp8(0, 8))],
    ['a zero height', webp(vp8(8, 0))],
    ['an unknown first chunk', webp(chunk('ALPH', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))],
    ['a VP8 frame without its start code', webp(chunk('VP8 ', [0, 0, 0, 1, 2, 3, 8, 0, 8, 0]))],
    ['a VP8L frame without its signature', webp(chunk('VP8L', [0x2e, 0, 0, 0, 0]))],
    ['a VP8 chunk too short to hold a size', webp(chunk('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a]))],
  ])('throws on %s', (_name, bytes) => {
    expect(() => webpInfo(bytes)).toThrow('The picture is not a WebP')
  })
})
