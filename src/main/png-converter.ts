// SPEC 6.2 [1.18]: the toPng that index.ts hands createCore. `decode` is Electron's
// nativeImage.createFromBuffer; it is passed in so this file needs no Electron to be tested.
export const PICTURE_NOT_DECODED = 'The picture could not be turned into a PNG'

type Decoded = { isEmpty(): boolean; toPNG(): Buffer }

export function pngConverter(
  decode: (buffer: Buffer) => Decoded,
): (bytes: Uint8Array) => Uint8Array {
  return (bytes) => {
    const image = decode(Buffer.from(bytes))
    if (image.isEmpty()) throw new Error(PICTURE_NOT_DECODED)
    return new Uint8Array(image.toPNG())
  }
}
