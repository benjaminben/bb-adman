// EX-1 (A-55): a JPEG's orientation tag, 1 to 8, read without decoding. toPng and the picture
// fitter turn the pixels by it, since the PNG they make carries no tag.
// Only the first APP1 segment that starts "Exif\0\0" is read. Inside it is a TIFF block: a
// byte-order mark ("II" little-endian, "MM" big-endian), 42, the offset of the first entry
// list (IFD0), then a 2-byte entry count and 12-byte entries [tag, type, count, value].
// Every read is checked against the segment's own bounds. Anything missing, broken or out of
// range is read as 1, upright. It never throws.
export type Orientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

const UPRIGHT: Orientation = 1
const APP1 = 0xe1
const ORIENTATION_TAG = 0x0112
const SHORT = 3
const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0, 0]

// The bounds [start, end) of the first APP1 segment's body, or null when there is none.
function firstApp1(bytes: Uint8Array): [number, number] | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let at = 2
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff) return null
    const marker = bytes[at + 1] ?? 0
    if (marker === 0xff) {
      at += 1
      continue
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2
      continue
    }
    if (marker === 0xd9 || marker === 0xda) return null
    const length = ((bytes[at + 2] ?? 0) << 8) | (bytes[at + 3] ?? 0)
    const end = at + 2 + length
    if (length < 2 || end > bytes.length) return null
    if (marker === APP1 && isExif(bytes, at + 4, end)) return [at + 4, end]
    at = end
  }
  return null
}

function isExif(bytes: Uint8Array, start: number, end: number): boolean {
  if (end - start < EXIF_HEADER.length) return false
  return EXIF_HEADER.every((byte, i) => bytes[start + i] === byte)
}

function isOrientation(value: number): value is Orientation {
  return Number.isInteger(value) && value >= 1 && value <= 8
}

// The tag in a TIFF block; `view` covers exactly the block, so no read can leave it.
function fromTiff(view: DataView): Orientation {
  const length = view.byteLength
  if (length < 8) return UPRIGHT
  const mark = view.getUint16(0)
  if (mark !== 0x4949 && mark !== 0x4d4d) return UPRIGHT
  const little = mark === 0x4949
  if (view.getUint16(2, little) !== 42) return UPRIGHT
  const ifd = view.getUint32(4, little)
  if (ifd < 8 || ifd > length - 2) return UPRIGHT
  const count = view.getUint16(ifd, little)
  if (ifd + 2 + count * 12 > length) return UPRIGHT
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12
    if (view.getUint16(entry, little) !== ORIENTATION_TAG) continue
    if (view.getUint16(entry + 2, little) !== SHORT) return UPRIGHT
    if (view.getUint32(entry + 4, little) !== 1) return UPRIGHT
    const value = view.getUint16(entry + 8, little)
    return isOrientation(value) ? value : UPRIGHT
  }
  return UPRIGHT
}

export function jpegOrientation(bytes: Uint8Array): Orientation {
  const segment = firstApp1(bytes)
  if (segment === null) return UPRIGHT
  const [start, end] = segment
  const tiffStart = start + EXIF_HEADER.length
  const view = new DataView(bytes.buffer, bytes.byteOffset + tiffStart, end - tiffStart)
  return fromTiff(view)
}
