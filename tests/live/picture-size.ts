// SPEC 6.2 [1.18], K4: the live test prints the picture's pixel size, read from the file itself:
// a PNG's IHDR chunk, or a JPEG's frame header.
// A JPEG is a list of segments: FF, a marker byte, then (for most markers) a 2-byte length that
// counts itself. The frame header (FFC0 to FFCF, but not FFC4, FFC8 or FFCC) holds the
// precision byte, then the height and the width as 2-byte big-endian numbers.
import { pngPixelSize } from './png-size'

type Size = { width: number; height: number }

const NOT_FRAMES = new Set([0xc4, 0xc8, 0xcc])

function isFrame(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && !NOT_FRAMES.has(marker)
}

// Markers with no length after them: the restart markers and TEM.
function standsAlone(marker: number): boolean {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)
}

function jpegPixelSize(bytes: Uint8Array): Size {
  const notJpeg = new Error('The picture is not a JPEG')
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw notJpeg
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let at = 2
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff) throw notJpeg
    const marker = bytes[at + 1] ?? 0
    if (marker === 0xff) {
      at += 1
      continue
    }
    if (standsAlone(marker)) {
      at += 2
      continue
    }
    if (marker === 0xd9 || marker === 0xda) break
    if (isFrame(marker)) {
      if (at + 9 > bytes.length) break
      return { width: view.getUint16(at + 7), height: view.getUint16(at + 5) }
    }
    at += 2 + view.getUint16(at + 2)
  }
  throw notJpeg
}

export function pictureSize(bytes: Uint8Array, mime: 'image/png' | 'image/jpeg'): Size {
  return mime === 'image/png' ? pngPixelSize(bytes) : jpegPixelSize(bytes)
}
