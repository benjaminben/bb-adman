// SPEC 14 [1.46], OI-79: the reference picture for the live Gemini reference case, made in
// code so it holds no repo file, user file, third-party art, person or brand. A square PNG:
// a large magenta circle on white, so a result that used it is easy to tell apart.
// Not a test file itself; its unit test is tests/unit/live/shape-picture.test.ts.
import zlib from 'node:zlib'

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const MAGENTA = [0xff, 0x00, 0xff]
const WHITE = [0xff, 0xff, 0xff]

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([head.subarray(4), data])), 0)
  return Buffer.concat([head, data, crc])
}

// Rows of 8-bit RGB, each led by filter type 0. The circle's radius is 0.4 of the side.
function circleRows(size: number): Buffer {
  const row = size * 3 + 1
  const raw = Buffer.alloc(row * size)
  const middle = (size - 1) / 2
  const radius = size * 0.4
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inside = (x - middle) ** 2 + (y - middle) ** 2 <= radius ** 2
      raw.set(inside ? MAGENTA : WHITE, y * row + 1 + x * 3)
    }
  }
  return raw
}

export function circlePng(size: number): Uint8Array {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr.set([8, 2, 0, 0, 0], 8) // 8-bit RGB, no interlace
  return new Uint8Array(
    Buffer.concat([
      SIGNATURE,
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(circleRows(size))),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  )
}
