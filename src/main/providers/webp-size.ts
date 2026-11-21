// Slice WP: a WebP's pixel size and animation flag, read from its RIFF header and first chunk
// without decoding. A file is RIFF, a little-endian size of what follows, WEBP, then chunks;
// the first chunk is VP8 (lossy), VP8L (lossless) or VP8X (extended, may be animated).
export type WebpInfo = { width: number; height: number; animated: boolean }

const ascii = (bytes: Uint8Array, at: number, text: string) =>
  [...text].every((c, i) => bytes[at + i] === c.charCodeAt(0))

function refuse(): never {
  throw new Error('The picture is not a WebP')
}

type Reader = (data: Uint8Array, view: DataView) => WebpInfo

const u24 = (view: DataView, at: number) =>
  view.getUint8(at) | (view.getUint8(at + 1) << 8) | (view.getUint8(at + 2) << 16)

const READERS: Record<string, { min: number; read: Reader }> = {
  // Frame tag (3 bytes), start code 9d 01 2a, then 14-bit width and height.
  'VP8 ': {
    min: 10,
    read: (data, view) => {
      if (data[3] !== 0x9d || data[4] !== 0x01 || data[5] !== 0x2a) refuse()
      const width = view.getUint16(6, true) & 0x3fff
      const height = view.getUint16(8, true) & 0x3fff
      return { width, height, animated: false }
    },
  },
  // Signature 0x2f, then width - 1 and height - 1 in 14 bits each.
  VP8L: {
    min: 5,
    read: (data, view) => {
      if (data[0] !== 0x2f) refuse()
      const bits = view.getUint32(1, true)
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1, animated: false }
    },
  },
  // Flags (0x02 is animation), 3 reserved bytes, then width - 1 and height - 1 in 24 bits.
  VP8X: {
    min: 10,
    read: (data, view) => ({
      width: u24(view, 4) + 1,
      height: u24(view, 7) + 1,
      animated: ((data[0] ?? 0) & 0x02) !== 0,
    }),
  },
}

export function webpInfo(bytes: Uint8Array): WebpInfo {
  if (bytes.length < 20 || !ascii(bytes, 0, 'RIFF') || !ascii(bytes, 8, 'WEBP')) refuse()
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(4, true) + 8 > bytes.length) refuse()
  const fourcc = String.fromCharCode(...bytes.subarray(12, 16))
  const reader = Object.hasOwn(READERS, fourcc) ? READERS[fourcc] : undefined
  const size = view.getUint32(16, true)
  if (!reader || size < reader.min || 20 + size > bytes.length) refuse()
  const data = bytes.subarray(20, 20 + size)
  const info = reader.read(data, new DataView(data.buffer, data.byteOffset, data.byteLength))
  if (info.width === 0 || info.height === 0) refuse()
  return info
}
