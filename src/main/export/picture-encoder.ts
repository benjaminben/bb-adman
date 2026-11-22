// CoreDeps.exportPictures (spec/phases/phase-08.md "Drawing at full size"). `decode` is
// Electron's nativeImage.createFromBuffer and `fromBitmap` its createFromBitmap; both are passed
// in so this file needs no Electron to be tested (the png-converter.ts model).
// Every picture out is a fresh encode of decoded pixels, so no chunk of a picture in (such as a
// `generation` text chunk) and no path can reach an exported file [FR-068].
import { stitchBitmaps } from './stitch'
import type { ExportPictures } from './types'

type Size = { width: number; height: number }

// The parts of a nativeImage the encoder may use.
export type EncoderImage = {
  isEmpty(): boolean
  getSize(): Size
  toBitmap(): Buffer
  toPNG(): Buffer
  toJPEG(quality: number): Buffer
  resize(options: {
    width: number
    height: number
    quality?: 'good' | 'better' | 'best'
  }): EncoderImage
}

const REPORT_JPEG_QUALITY = 80

function notRead(): never {
  throw new Error('The picture could not be read.')
}

// The size of a picture shrunk so its longest side is maxSide; the other side keeps the ratio
// and is at least 1.
function shrunkSize(size: Size, maxSide: number): Size {
  const scale = maxSide / Math.max(size.width, size.height)
  const side = (n: number) => Math.max(1, Math.round(n * scale))
  return { width: side(size.width), height: side(size.height) }
}

export function createExportPictures(
  decode: (bytes: Buffer) => EncoderImage,
  fromBitmap: (data: Buffer, size: Size) => EncoderImage,
): ExportPictures {
  function read(bytes: Uint8Array): EncoderImage {
    const image = decode(Buffer.from(bytes))
    if (image.isEmpty()) notRead()
    return image
  }

  function bitmapOf(bytes: Uint8Array): { size: Size; data: Buffer } {
    const image = read(bytes)
    const size = image.getSize()
    const data = image.toBitmap()
    if (data.length !== size.width * size.height * 4) notRead()
    return { size, data }
  }

  return {
    toJpeg(png, quality) {
      return new Uint8Array(read(png).toJPEG(quality))
    },

    stitch(parts, size) {
      const bitmaps = parts.map((part) => {
        const { size: s, data } = bitmapOf(part.png)
        return { x: part.x, y: part.y, width: s.width, height: s.height, data }
      })
      const joined = stitchBitmaps(bitmaps, size)
      const image = fromBitmap(Buffer.from(joined.buffer, joined.byteOffset, joined.length), size)
      if (image.isEmpty()) notRead()
      return new Uint8Array(image.toPNG())
    },

    shrink(png, maxSide) {
      const image = read(png)
      const small = image.resize({ ...shrunkSize(image.getSize(), maxSide), quality: 'best' })
      return new Uint8Array(small.toJPEG(REPORT_JPEG_QUALITY))
    },
  }
}
