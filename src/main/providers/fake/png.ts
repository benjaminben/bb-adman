// Plain PNGs made in memory for the fake provider: a grey picture, and the alpha form (colour
// type 6) the cut-out part gives, grey and solid in the middle half, see-through elsewhere.
import zlib from 'node:zlib'

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const GREY = 0x80

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([head.subarray(4), data])), 0)
  return Buffer.concat([head, data, crc])
}

// raw holds each row as a filter byte (0) followed by the row's pixels.
function png(width: number, height: number, colourType: number, raw: Buffer): Uint8Array {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr.set([8, colourType, 0, 0, 0], 8) // 8 bits a channel, no interlace
  return new Uint8Array(
    Buffer.concat([
      SIGNATURE,
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  )
}

export function greyPng(width: number, height: number): Uint8Array {
  const raw = Buffer.alloc((width + 1) * height, GREY)
  for (let y = 0; y < height; y++) raw[y * (width + 1)] = 0
  return png(width, height, 0, raw)
}

// In the middle half of a side: from a quarter of it to three quarters.
const inMiddle = (at: number, side: number) => at >= side / 4 && at < (side * 3) / 4

// Colour type 6 (red, green, blue, alpha). Every byte starts at 0: see-through.
export function cutoutPng(width: number, height: number): Uint8Array {
  const row = width * 4 + 1
  const raw = Buffer.alloc(row * height, 0)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!inMiddle(x, width) || !inMiddle(y, height)) continue
      const at = y * row + 1 + x * 4
      raw.set([GREY, GREY, GREY, 255], at)
    }
  }
  return png(width, height, 6, raw)
}
