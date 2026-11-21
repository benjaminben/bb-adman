// SPEC 6.2 [1.18]: the toPng that index.ts hands createCore. `decode` is Electron's
// nativeImage.createFromBuffer; it is passed in so this file needs no Electron to be tested.
// [1.20] L2: the limits of Section 6.2 are checked here, before the decoder sees the bytes.
// Every refusal is the one fixed message: it holds no bytes, no size and no path.
import { MAX_PICTURE_BYTES } from './providers/picture-limits'
import { pictureType } from './providers/picture-type'

export const PICTURE_NOT_DECODED = 'The picture could not be turned into a PNG'

type Decoded = { isEmpty(): boolean; toPNG(): Buffer }

function refuse(): never {
  throw new Error(PICTURE_NOT_DECODED)
}

export function pngConverter(
  decode: (buffer: Buffer) => Decoded,
): (bytes: Uint8Array) => Uint8Array {
  return (bytes) => {
    if (bytes.byteLength > MAX_PICTURE_BYTES) refuse()
    if (pictureType(bytes) === undefined) refuse()
    const image = decode(Buffer.from(bytes))
    if (image.isEmpty()) refuse()
    const png = image.toPNG()
    if (png.byteLength === 0) refuse()
    return new Uint8Array(png)
  }
}
