import { describe, it, expect } from 'vitest'
import { webpHeadInfo } from '@/main/providers/webp-size'
import { chunk, vp8, vp8l, vp8x, webp } from '../../../fixtures/webp-bytes'

// The first bytes of a WebP whose RIFF size says it holds far more than was read.
const headOf = (chunks: number[]) => webp(chunks, 5_000_000)

// A VP8X chunk whose stated size (byte 5 is the second size byte) is far past its 10 bytes.
const longVp8x = vp8x(20, 10, true).map((b, i) => (i === 5 ? 0x40 : b))

describe('webpHeadInfo reads the first chunk from the first bytes only [S2-17]', () => {
  it.each([
    ['a still lossy file', webp(vp8(640, 480)), { width: 640, height: 480, animated: false }],
    ['a still lossless file', webp(vp8l(16, 9)), { width: 16, height: 9, animated: false }],
    ['a still VP8X file', webp(vp8x(30, 20, false)), { width: 30, height: 20, animated: false }],
    ['an animated VP8X file', webp(vp8x(20, 10, true)), { width: 20, height: 10, animated: true }],
    [
      'the animation flag of a file larger than the bytes passed',
      headOf(vp8x(20, 10, true)),
      { width: 20, height: 10, animated: true },
    ],
    [
      'a still frame of a file larger than the bytes passed',
      headOf(vp8(8, 8)),
      { width: 8, height: 8, animated: false },
    ],
    [
      'a first chunk whose stated size runs past the bytes passed',
      headOf(longVp8x),
      { width: 20, height: 10, animated: true },
    ],
  ])('%s', (_name, bytes, info) => {
    expect(webpHeadInfo(bytes)).toEqual(info)
  })

  const whole = webp(vp8x(20, 10, true))
  it.each([
    ['a header cut off inside the first chunk', whole.slice(0, whole.length - 1)],
    ['a header cut off inside the RIFF header', whole.slice(0, 10)],
    ['no bytes', new Uint8Array(0)],
    ['bytes that are not a RIFF file', new Uint8Array([...whole].fill(0, 0, 4))],
    ['a RIFF file that is not a WebP', new Uint8Array([...whole].fill(0x41, 8, 12))],
    ['an unknown first chunk', webp(chunk('ALPH', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))],
    ['a VP8X chunk too short to hold a size', webp(chunk('VP8X', [0x12, 0, 0, 0]))],
    ['a zero width', webp(vp8(0, 8))],
  ])('throws its own error on %s', (_name, bytes) => {
    expect(() => webpHeadInfo(bytes)).toThrow('The picture is not a WebP')
  })
})
