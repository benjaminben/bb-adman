// A plain grey PNG of a given size, made in memory for the fake provider.
import zlib from 'node:zlib'

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([head.subarray(4), data])), 0)
  return Buffer.concat([head, data, crc])
}

export function greyPng(width: number, height: number): Uint8Array {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr.set([8, 0, 0, 0, 0], 8) // 8-bit grey, no interlace
  const raw = Buffer.alloc((width + 1) * height, 0x80)
  for (let y = 0; y < height; y++) raw[y * (width + 1)] = 0 // filter type per row
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
