// P4-9 case 8: what a cut-out's PNG says about see-through pixels. The colour type from the
// header (6 is red, green, blue, alpha), and for an 8- or 16-bit, non-interlaced colour type 6
// file, how many pixels are fully and partly see-through. Reads the bytes in memory only.
import zlib from 'node:zlib'

export type AlphaCount = { pixels: number; clear: number; partly: number }

const SIGNATURE_BYTES = 8

// The header's colour type, or null when the bytes are not a PNG with a header first.
export function pngColourType(bytes: Uint8Array): number | null {
  const head = Buffer.from(bytes.subarray(12, 16)).toString('latin1')
  return bytes.byteLength >= 26 && head === 'IHDR' ? (bytes[25] ?? null) : null
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  return pb <= pc ? b : c
}

// Undoes the per-row filters in place and gives the rows without their filter bytes.
function unfiltered(raw: Buffer, stride: number, height: number, bpp: number): Buffer {
  const out = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)] ?? 0
    const row = y * (stride + 1) + 1
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? (out[y * stride + x - bpp] ?? 0) : 0
      const b = y > 0 ? (out[(y - 1) * stride + x] ?? 0) : 0
      const c = x >= bpp && y > 0 ? (out[(y - 1) * stride + x - bpp] ?? 0) : 0
      const value = raw[row + x] ?? 0
      const add = [0, a, b, (a + b) >> 1, paeth(a, b, c)][filter] ?? 0
      out[y * stride + x] = (value + add) & 0xff
    }
  }
  return out
}

// The alpha counts, or null for a file this reader does not take.
export function countAlpha(bytes: Uint8Array): AlphaCount | null {
  const buf = Buffer.from(bytes)
  if (pngColourType(bytes) !== 6) return null
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  const depth = buf[24]
  if ((depth !== 8 && depth !== 16) || buf[28] !== 0) return null
  const data: Buffer[] = []
  for (let at = SIGNATURE_BYTES; at + 8 <= buf.byteLength;) {
    const length = buf.readUInt32BE(at)
    const type = buf.toString('latin1', at + 4, at + 8)
    if (type === 'IDAT') data.push(buf.subarray(at + 8, at + 8 + length))
    at += 12 + length
  }
  const bpp = depth === 8 ? 4 : 8
  const pixels = unfiltered(zlib.inflateSync(Buffer.concat(data)), width * bpp, height, bpp)
  const full = depth === 8 ? 0xff : 0xffff
  let clear = 0
  let partly = 0
  for (let i = 0; i < width * height; i++) {
    const at = i * bpp + (bpp - (depth === 8 ? 1 : 2))
    const alpha = depth === 8 ? (pixels[at] ?? 0) : pixels.readUInt16BE(at)
    if (alpha === 0) clear++
    else if (alpha !== full) partly++
  }
  return { pixels: width * height, clear, partly }
}
