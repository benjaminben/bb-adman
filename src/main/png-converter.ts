// SPEC 6.2 [1.18]: the toPng that index.ts hands createCore. `decode` is Electron's
// nativeImage.createFromBuffer; it is passed in so this file needs no Electron to be tested.
// [1.20] L2: the limits of Section 6.2 are checked here, before the decoder sees the bytes.
// Every refusal is the one fixed message: it holds no bytes, no size and no path.
import { MAX_PICTURE_BYTES, MAX_PICTURE_PIXELS, MAX_PICTURE_SIDE } from './providers/picture-limits'
import { pictureSize } from './providers/picture-size'
import { pictureType } from './providers/picture-type'

export const PICTURE_NOT_DECODED = 'The picture could not be turned into a PNG'

type Decoded = { isEmpty(): boolean; toPNG(): Buffer }

function refuse(): never {
  throw new Error(PICTURE_NOT_DECODED)
}

// [1.21] L7, step 3: the size the header states. A header that cannot be read is a refusal.
function statedSize(bytes: Uint8Array, mime: 'image/png' | 'image/jpeg') {
  try {
    return pictureSize(bytes, mime)
  } catch {
    return refuse()
  }
}

function sideFits(side: number): boolean {
  return side > 0 && side <= MAX_PICTURE_SIDE
}

// [1.60] N-1: the checks made before any decode, in this order. pictureFitter runs them too.
export function checkBeforeDecode(bytes: Uint8Array): void {
  if (bytes.byteLength > MAX_PICTURE_BYTES) refuse()
  const mime = pictureType(bytes)
  if (mime === undefined) refuse()
  const { width, height } = statedSize(bytes, mime)
  if (!sideFits(width) || !sideFits(height) || width * height > MAX_PICTURE_PIXELS) refuse()
}

export function pngConverter(
  decode: (buffer: Buffer) => Decoded,
): (bytes: Uint8Array) => Uint8Array {
  return (bytes) => {
    checkBeforeDecode(bytes)
    const image = decode(Buffer.from(bytes))
    if (image.isEmpty()) refuse()
    const png = image.toPNG()
    if (png.byteLength === 0) refuse()
    return new Uint8Array(png)
  }
}
