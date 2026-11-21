// SPEC 6.10.7 [1.60], 14 CU-6b-F N-1, N-2: the fitPicture index.ts hands createCore. It
// fits a first frame to a video run: crop first, then scale, never stretch (FR-286).
// `decode` is Electron's nativeImage.createFromBuffer, passed in so tests need no Electron.
// It runs pngConverter's checks before decoding, and every refusal is toPng's fixed message:
// it holds no bytes, no size, no path and no decoder text.
import { checkBeforeDecode, PICTURE_NOT_DECODED } from './png-converter'
import { MAX_PICTURE_SIDE } from './providers/picture-limits'

type Size = { width: number; height: number }
type Rect = Size & { x: number; y: number }

type Fittable = {
  isEmpty(): boolean
  getSize(): Size
  crop(rect: Rect): Fittable
  resize(options: Size & { quality: 'best' }): Fittable
  toPNG(): Buffer
}

function refuse(): never {
  throw new Error(PICTURE_NOT_DECODED)
}

function sideFits(side: number): boolean {
  return Number.isInteger(side) && side > 0 && side <= MAX_PICTURE_SIDE
}

// The largest centred rectangle of the run's shape, in whole pixels, or null for all of it.
export function cropBox(picture: Size, run: Size): Rect | null {
  const wide = picture.width * run.height
  const tall = picture.height * run.width
  if (wide > tall) {
    const width = Math.max(1, Math.round((picture.height * run.width) / run.height))
    return { x: Math.floor((picture.width - width) / 2), y: 0, width, height: picture.height }
  }
  if (wide < tall) {
    const height = Math.max(1, Math.round((picture.width * run.height) / run.width))
    return { x: 0, y: Math.floor((picture.height - height) / 2), width: picture.width, height }
  }
  return null
}

function sameSize(a: Size, b: Size): boolean {
  return a.width === b.width && a.height === b.height
}

function fit(image: Fittable, run: Size): Fittable {
  if (image.isEmpty()) refuse()
  const size = image.getSize()
  if (size.width <= 0 || size.height <= 0) refuse()
  if (sameSize(size, run)) return image
  const box = cropBox(size, run)
  const cropped = box === null ? image : image.crop(box)
  if (cropped.isEmpty()) refuse()
  if (sameSize(cropped.getSize(), run)) return cropped
  return cropped.resize({ width: run.width, height: run.height, quality: 'best' })
}

export function pictureFitter(
  decode: (buffer: Buffer) => Fittable,
): (bytes: Uint8Array, run: Size) => Uint8Array {
  return (bytes, run) => {
    checkBeforeDecode(bytes)
    if (!sideFits(run.width) || !sideFits(run.height)) refuse()
    let png: Buffer
    try {
      png = fit(decode(Buffer.from(bytes)), run).toPNG()
    } catch {
      return refuse()
    }
    if (png.byteLength === 0) refuse()
    return new Uint8Array(png)
  }
}
