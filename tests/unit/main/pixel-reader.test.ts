// R2E-2 (spec/phases/round-2-editor.md D2, "Pixels"): CoreDeps.readPixels over a stand-in for
// nativeImage. The decoder gives BGRA; the reader gives RGBA.
import { describe, it, expect } from 'vitest'
import { noPixels, pixelReader, type PixelImage } from '@/main/pixel-reader'

function image(width: number, height: number, bgra: number[]): PixelImage {
  return {
    isEmpty: () => width === 0 || height === 0,
    getSize: () => ({ width, height }),
    toBitmap: () => Buffer.from(bgra),
  }
}

const PNG = new Uint8Array([137, 80, 78, 71])

describe('pixelReader [D2 "Pixels"]', () => {
  it('swaps BGRA into RGBA and gives the size', () => {
    const decoded: Uint8Array[] = []
    const read = pixelReader((buffer) => {
      decoded.push(new Uint8Array(buffer))
      return image(2, 1, [1, 2, 3, 4, 10, 20, 30, 40])
    })
    const pixels = read(PNG)
    expect(decoded).toEqual([PNG])
    expect(pixels.width).toBe(2)
    expect(pixels.height).toBe(1)
    expect([...pixels.rgba]).toEqual([3, 2, 1, 4, 30, 20, 10, 40])
  })

  it('throws for an empty picture', () => {
    const read = pixelReader(() => image(0, 0, []))
    expect(() => read(PNG)).toThrow()
  })

  it('throws when the bitmap is not four bytes a pixel', () => {
    const read = pixelReader(() => image(2, 2, [1, 2, 3, 4]))
    expect(() => read(PNG)).toThrow()
  })

  it('has a default that throws', () => {
    expect(() => noPixels(PNG)).toThrow('readPixels is not available')
  })
})
