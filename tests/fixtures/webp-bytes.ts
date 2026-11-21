// Hand-made WebP headers for the slice WP tests: the RIFF wrapper and the first chunk of
// each kind, with no picture data behind it. Not a test file itself.
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0))

function u32le(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]
}

const u24le = (n: number) => u32le(n).slice(0, 3)

export function chunk(fourcc: string, data: number[]): number[] {
  return [...ascii(fourcc), ...u32le(data.length), ...data]
}

// RIFF, the size of what follows it, WEBP, then the chunks. `riffSize` overrides the size.
export function webp(chunks: number[], riffSize = chunks.length + 4): Uint8Array {
  return new Uint8Array([...ascii('RIFF'), ...u32le(riffSize), ...ascii('WEBP'), ...chunks])
}

// A lossy frame: a 3-byte frame tag, the start code, then 14-bit width and height.
export function vp8(width: number, height: number): number[] {
  const w = [width & 0xff, (width >>> 8) & 0x3f]
  const h = [height & 0xff, (height >>> 8) & 0x3f]
  return chunk('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, ...w, ...h])
}

// A lossless frame: the 0x2f signature, then width - 1 and height - 1 in 14 bits each.
export function vp8l(width: number, height: number): number[] {
  const bits = (width - 1) | ((height - 1) << 14)
  return chunk('VP8L', [0x2f, ...u32le(bits)])
}

// The extended header: flags (0x02 is animation), 3 reserved bytes, width - 1 and height - 1.
export function vp8x(width: number, height: number, animated: boolean): number[] {
  const flags = animated ? 0x12 : 0x10
  return chunk('VP8X', [flags, 0, 0, 0, ...u24le(width - 1), ...u24le(height - 1)])
}
