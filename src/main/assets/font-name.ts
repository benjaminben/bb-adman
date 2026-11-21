// SPEC scene.md "Font names at import" [REQ: FR-056]: the family name a font file gives
// itself, read from its `name` table. The bytes are untrusted: every offset, length and count
// is checked against the data before it is used, and anything that cannot be read gives null.
// No text from the file reaches a log or an error.
import zlib from 'node:zlib'

// The most a WOFF2 stream may decompress to, and the largest font file whose name is read.
export const MAX_FONT_BYTES = 32 * 1024 * 1024
const MAX_NAME_CHARS = 100
const WOFF2_HEADER_BYTES = 48

// WOFF2 known-tag indexes (WOFF2 5.1), and the flag value for a tag written out in full.
const NAME_INDEX = 5
const GLYF_INDEX = 10
const LOCA_INDEX = 11
const OWN_TAG = 63

// Mac Roman bytes 0x80 to 0xFF.
const MAC_ROMAN =
  'ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø' +
  '¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ'

const fits = (b: Uint8Array, at: number, length: number) =>
  at >= 0 && length >= 0 && at + length <= b.length

const viewOf = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength)

const tagAt = (b: Uint8Array, at: number) =>
  String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3])

// The `name` table of a TTF or OTF file.
function sfntNameTable(b: Uint8Array): Uint8Array | null {
  if (!fits(b, 0, 12)) return null
  const view = viewOf(b)
  const count = view.getUint16(4)
  if (!fits(b, 12, count * 16)) return null
  for (let i = 0; i < count; i++) {
    const at = 12 + i * 16
    if (tagAt(b, at) !== 'name') continue
    const offset = view.getUint32(at + 8)
    const length = view.getUint32(at + 12)
    return fits(b, offset, length) ? b.subarray(offset, offset + length) : null
  }
  return null
}

// A WOFF2 UIntBase128 (WOFF2 4.1): at most 5 bytes, no leading zero, fits in 32 bits.
function base128(b: Uint8Array, at: number): { value: number; next: number } | null {
  let value = 0
  for (let i = 0; i < 5; i++) {
    if (!fits(b, at + i, 1)) return null
    const byte = b[at + i]
    if (i === 0 && byte === 0x80) return null
    if (value >= 2 ** 25) return null
    value = value * 128 + (byte & 0x7f)
    if ((byte & 0x80) === 0) return { value, next: at + i + 1 }
  }
  return null
}

type Span = { offset: number; length: number }

// Where the `name` table sits in the decompressed WOFF2 data, and where the directory ends.
function woff2Directory(b: Uint8Array, count: number): { name: Span; end: number } | null {
  let at = WOFF2_HEADER_BYTES
  let offset = 0
  let name: Span | null = null
  for (let i = 0; i < count; i++) {
    if (!fits(b, at, 1)) return null
    const index = b[at] & 0x3f
    const version = b[at] >> 6
    at += 1
    let tag = ''
    if (index === OWN_TAG) {
      if (!fits(b, at, 4)) return null
      tag = tagAt(b, at)
      at += 4
    }
    const orig = base128(b, at)
    if (!orig) return null
    at = orig.next
    let length = orig.value
    const glyfLike =
      index === GLYF_INDEX || index === LOCA_INDEX || tag === 'glyf' || tag === 'loca'
    const transformed = glyfLike ? version !== 3 : version !== 0
    if (transformed) {
      const stored = base128(b, at)
      if (!stored) return null
      at = stored.next
      length = stored.value
    }
    const isName = index === NAME_INDEX || tag === 'name'
    if (isName && transformed) return null
    if (isName && !name) name = { offset, length }
    offset += length
    if (offset > MAX_FONT_BYTES) return null
  }
  return name ? { name, end: at } : null
}

// The `name` table of a WOFF2 file, after decompressing its one Brotli stream with a cap.
function woff2NameTable(b: Uint8Array): Uint8Array | null {
  if (!fits(b, 0, WOFF2_HEADER_BYTES)) return null
  if (tagAt(b, 4) === 'ttcf') return null
  const view = viewOf(b)
  const directory = woff2Directory(b, view.getUint16(12))
  if (!directory) return null
  const compressed = view.getUint32(20)
  if (!fits(b, directory.end, compressed)) return null
  const tables = zlib.brotliDecompressSync(b.subarray(directory.end, directory.end + compressed), {
    maxOutputLength: MAX_FONT_BYTES,
  })
  const { offset, length } = directory.name
  return fits(tables, offset, length) ? tables.subarray(offset, offset + length) : null
}

function nameTableOf(b: Uint8Array): Uint8Array | null {
  if (!fits(b, 0, 4)) return null
  const tag = tagAt(b, 0)
  if (tag === 'wOF2') return woff2NameTable(b)
  if (tag === 'OTTO' || tag === 'true' || tag === '\0\x01\0\0') return sfntNameTable(b)
  return null
}

// Lower is better: name ID 16 before 1, platform 3 before 1, English before other languages.
function rank(platform: number, encoding: number, language: number, nameId: number): number {
  if (nameId !== 16 && nameId !== 1) return -1
  if (platform !== 3 && !(platform === 1 && encoding === 0)) return -1
  const english = platform === 3 ? language === 0x0409 : language === 0
  return (nameId === 16 ? 0 : 4) + (platform === 3 ? 0 : 2) + (english ? 0 : 1)
}

type Pick = { platform: number; start: number; length: number }

// The best record of a `name` table; the first one wins a tie.
function pickRecord(t: Uint8Array): Pick | null {
  if (!fits(t, 0, 6)) return null
  const view = viewOf(t)
  const count = view.getUint16(2)
  const strings = view.getUint16(4)
  if (!fits(t, 6, count * 12)) return null
  let best: Pick | null = null
  let bestRank = Infinity
  for (let i = 0; i < count; i++) {
    const at = 6 + i * 12
    const platform = view.getUint16(at)
    const r = rank(platform, view.getUint16(at + 2), view.getUint16(at + 4), view.getUint16(at + 6))
    if (r < 0 || r >= bestRank) continue
    bestRank = r
    best = { platform, start: strings + view.getUint16(at + 10), length: view.getUint16(at + 8) }
  }
  return best
}

function decode(bytes: Uint8Array, platform: number): string {
  let text = ''
  if (platform === 3) {
    for (let i = 0; i + 1 < bytes.length; i += 2)
      text += String.fromCharCode((bytes[i] << 8) | bytes[i + 1])
    return text.replace(
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
      '�',
    )
  }
  for (const byte of bytes) text += byte < 0x80 ? String.fromCharCode(byte) : MAC_ROMAN[byte - 0x80]
  return text
}

// Control characters removed, trimmed, at most 100 characters; empty gives null.
function clean(text: string): string | null {
  const plain = text.replace(/\p{Cc}/gu, '').trim()
  const cut = Array.from(plain).slice(0, MAX_NAME_CHARS).join('').trim()
  return cut === '' ? null : cut
}

function readName(bytes: Uint8Array): string | null {
  const table = nameTableOf(bytes)
  if (!table) return null
  const pick = pickRecord(table)
  if (!pick || !fits(table, pick.start, pick.length)) return null
  return clean(decode(table.subarray(pick.start, pick.start + pick.length), pick.platform))
}

// The family name of a TTF, OTF or WOFF2 file, or null. Never throws.
export function readFontFamily(bytes: Uint8Array): string | null {
  try {
    return readName(bytes)
  } catch {
    return null
  }
}
