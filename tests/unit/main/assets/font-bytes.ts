// Test helper: font files made from bytes, for the font name reader. Not a test file itself.
import zlib from 'node:zlib'

export type NameRecord = {
  platform: number
  encoding: number
  language: number
  nameId: number
  text: string
}

const textBytes = (r: NameRecord): Buffer => {
  if (r.platform !== 3) return Buffer.from(r.text, 'latin1')
  const b = Buffer.alloc(r.text.length * 2)
  for (let i = 0; i < r.text.length; i++) b.writeUInt16BE(r.text.charCodeAt(i), i * 2)
  return b
}

// A `name` table, format 0. `count` overrides the record count written in the header.
export function nameTable(records: NameRecord[], count = records.length): Buffer {
  const strings = records.map(textBytes)
  const head = Buffer.alloc(6 + records.length * 12)
  head.writeUInt16BE(0, 0)
  head.writeUInt16BE(count, 2)
  head.writeUInt16BE(head.length, 4)
  let offset = 0
  records.forEach((r, i) => {
    const at = 6 + i * 12
    head.writeUInt16BE(r.platform, at)
    head.writeUInt16BE(r.encoding, at + 2)
    head.writeUInt16BE(r.language, at + 4)
    head.writeUInt16BE(r.nameId, at + 6)
    head.writeUInt16BE(strings[i].length, at + 8)
    head.writeUInt16BE(offset, at + 10)
    offset += strings[i].length
  })
  return Buffer.concat([head, ...strings])
}

export const win = (nameId: number, text: string, language = 0x0409): NameRecord => ({
  platform: 3,
  encoding: 1,
  language,
  nameId,
  text,
})

export const mac = (nameId: number, text: string, language = 0): NameRecord => ({
  platform: 1,
  encoding: 0,
  language,
  nameId,
  text,
})

export type Table = { tag: string; data: Buffer }

const pad4 = (b: Buffer) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)])

// A TTF ('ttf') or OTF ('otf') file holding the given tables.
export function sfnt(flavor: 'ttf' | 'otf', tables: Table[]): Buffer {
  const dir = Buffer.alloc(12 + tables.length * 16)
  if (flavor === 'otf') dir.write('OTTO', 0, 'latin1')
  else dir.writeUInt32BE(0x00010000, 0)
  dir.writeUInt16BE(tables.length, 4)
  let offset = dir.length
  tables.forEach((t, i) => {
    const at = 12 + i * 16
    dir.write(t.tag, at, 'latin1')
    dir.writeUInt32BE(offset, at + 8)
    dir.writeUInt32BE(t.data.length, at + 12)
    offset += pad4(t.data).length
  })
  return Buffer.concat([dir, ...tables.map((t) => pad4(t.data))])
}

const KNOWN: Record<string, number> = { hmtx: 3, name: 5, glyf: 10, loca: 11 }

const base128 = (n: number): Buffer => {
  const out: number[] = [n & 0x7f]
  for (let v = Math.floor(n / 128); v > 0; v = Math.floor(v / 128)) out.unshift(0x80 | (v & 0x7f))
  return Buffer.from(out)
}

// One WOFF2 table directory entry. `transformed` writes a transform length equal to the length.
function entry(t: Table, transformed: boolean): Buffer {
  const known = KNOWN[t.tag]
  const glyfLike = t.tag === 'glyf' || t.tag === 'loca'
  const version = glyfLike ? (transformed ? 0 : 3) : transformed ? 1 : 0
  const flags = Buffer.from([(version << 6) | (known ?? 63)])
  const tag = known === undefined ? Buffer.from(t.tag, 'latin1') : Buffer.alloc(0)
  const lengths = transformed
    ? [base128(t.data.length), base128(t.data.length)]
    : [base128(t.data.length)]
  return Buffer.concat([flags, tag, ...lengths])
}

export type Woff2Options = { transformed?: string[]; flavor?: string; stream?: Buffer }

// A WOFF2 file: header, table directory and one Brotli stream of the tables.
export function woff2(tables: Table[], opts: Woff2Options = {}): Buffer {
  const dir = Buffer.concat(tables.map((t) => entry(t, opts.transformed?.includes(t.tag) ?? false)))
  const stream =
    opts.stream ??
    zlib.brotliCompressSync(Buffer.concat(tables.map((t) => t.data)), {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 1 },
    })
  const head = Buffer.alloc(48)
  head.write('wOF2', 0, 'latin1')
  head.write(opts.flavor ?? '\0\x01\0\0', 4, 'latin1')
  head.writeUInt32BE(48 + dir.length + stream.length, 8)
  head.writeUInt16BE(tables.length, 12)
  head.writeUInt32BE(stream.length, 20)
  return Buffer.concat([head, dir, stream])
}

// A short stream that decompresses to `start` followed by zeros, `bytes` in all.
export function oversizedStream(bytes: number, start = Buffer.alloc(0)): Buffer {
  const data = Buffer.alloc(bytes)
  start.copy(data)
  return zlib.brotliCompressSync(data, {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 1 },
  })
}
