// EX-1: turns and mirrors a decoded picture, four bytes a pixel, so it shows the way its
// JPEG orientation tag says. Each pixel's four bytes move together, so the byte order of the
// channels does not matter. Tags 5 to 8 swap the width and the height; the pixel count stays.
import type { Orientation } from './jpeg-orientation'

type Size = { width: number; height: number }
export type Pixels = Size & { data: Uint8Array }

// For a pixel (x, y) of the turned picture, the pixel of the stored one it comes from.
function source(tag: Orientation, x: number, y: number, { width, height }: Size): [number, number] {
  switch (tag) {
    case 2:
      return [width - 1 - x, y]
    case 3:
      return [width - 1 - x, height - 1 - y]
    case 4:
      return [x, height - 1 - y]
    case 5:
      return [y, x]
    case 6:
      return [y, height - 1 - x]
    case 7:
      return [width - 1 - y, height - 1 - x]
    case 8:
      return [width - 1 - y, x]
    default:
      return [x, y]
  }
}

export function turnPixels(data: Uint8Array, size: Size, tag: Orientation): Pixels {
  const swapped = tag >= 5
  const width = swapped ? size.height : size.width
  const height = swapped ? size.width : size.height
  // A copy, so the 32-bit view starts on a 4-byte boundary whatever `data` was cut from.
  const from = new Uint32Array(new Uint8Array(data).buffer)
  const to = new Uint32Array(from.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [sx, sy] = source(tag, x, y, size)
      to[y * width + x] = from[sy * size.width + sx] ?? 0
    }
  }
  return { width, height, data: new Uint8Array(to.buffer) }
}
