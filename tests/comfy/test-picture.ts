// SPEC 14 1.46: the test's own picture for the reference case. Made here, in memory, with
// node:zlib: about 768 x 768, plain coloured shapes. Never a file from the user's disk, a
// project or an asset. The same bytes every time, so its upload name never changes and the
// server keeps one copy only.
import zlib from 'node:zlib'

export const TEST_PICTURE_SIDE = 768

type Rgb = [number, number, number]

const GROUND: Rgb = [240, 236, 226]
const RED: Rgb = [214, 48, 49]
const BLUE: Rgb = [9, 132, 227]
const GREEN: Rgb = [0, 148, 50]

// A red square, a blue disc and a green band.
function colourAt(x: number, y: number): Rgb {
  if (x >= 96 && x < 336 && y >= 96 && y < 336) return RED
  if ((x - 540) ** 2 + (y - 540) ** 2 < 150 ** 2) return BLUE
  if (y >= 640 && y < 700 && x >= 64 && x < 704) return GREEN
  return GROUND
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([head.subarray(4), data])), 0)
  return Buffer.concat([head, data, crc])
}

export function makeTestPicture(): Uint8Array {
  const side = TEST_PICTURE_SIDE
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(side, 0)
  ihdr.writeUInt32BE(side, 4)
  ihdr.set([8, 2, 0, 0, 0], 8) // 8-bit RGB, no interlace
  const row = side * 3 + 1
  const raw = Buffer.alloc(row * side)
  for (let y = 0; y < side; y++) {
    // Filter type 0 at the start of each row.
    for (let x = 0; x < side; x++) raw.set(colourAt(x, y), y * row + 1 + x * 3)
  }
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return new Uint8Array(
    Buffer.concat([
      signature,
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  )
}
