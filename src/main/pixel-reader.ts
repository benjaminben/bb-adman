// CoreDeps.readPixels (spec/phases/round-2-editor.md D2, "Pixels"): a PNG the app drew itself,
// decoded to four bytes a pixel in red, green, blue, alpha order. `decode` is Electron's
// nativeImage.createFromBuffer, passed in so this file needs no Electron to be tested (the
// png-converter.ts model). nativeImage's bitmap is BGRA (as stitch.ts notes), so the reader
// swaps blue and red. Every refusal is one fixed message with no picture data in it.
import type { Pixels } from '@/shared/generation/contrast'

export type PixelImage = {
  isEmpty(): boolean
  getSize(): { width: number; height: number }
  toBitmap(): Buffer
}

const NOT_READ = 'The picture could not be read'

export function pixelReader(decode: (buffer: Buffer) => PixelImage): (png: Uint8Array) => Pixels {
  return (png) => {
    const image = decode(Buffer.from(png))
    const { width, height } = image.getSize()
    if (image.isEmpty() || width <= 0 || height <= 0) throw new Error(NOT_READ)
    const bgra = image.toBitmap()
    if (bgra.length !== width * height * 4) throw new Error(NOT_READ)
    const rgba = new Uint8Array(bgra.length)
    for (let i = 0; i < bgra.length; i += 4) {
      rgba[i] = bgra[i + 2] ?? 0
      rgba[i + 1] = bgra[i + 1] ?? 0
      rgba[i + 2] = bgra[i] ?? 0
      rgba[i + 3] = bgra[i + 3] ?? 0
    }
    return { width, height, rgba }
  }
}

// The default when index.ts hands in no reader, as toPng's: the contrast check is skipped.
export const noPixels: (png: Uint8Array) => Pixels = () => {
  throw new Error('readPixels is not available')
}
