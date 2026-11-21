import { describe, it, expect } from 'vitest'
import { readFontFamily } from '@/main/assets/font-name'
import {
  mac,
  nameTable,
  oversizedStream,
  sfnt,
  win,
  woff2,
  type NameRecord,
  type Table,
} from './font-bytes'

const filler = (tag: string, n = 20): Table => ({ tag, data: Buffer.alloc(n, 7) })
const named = (records: NameRecord[]): Table => ({ tag: 'name', data: nameTable(records) })

describe('readFontFamily, the name a font file gives itself [SPEC scene.md, FR-056]', () => {
  const ttf = (records: NameRecord[]) => sfnt('ttf', [filler('head'), named(records)])

  it.each([
    ['a TTF', ttf([win(1, 'Brand Sans')])],
    ['an OTF', sfnt('otf', [filler('CFF '), named([win(1, 'Brand Sans')])])],
    ['a WOFF2', woff2([filler('head'), named([win(1, 'Brand Sans')])])],
    [
      'a WOFF2 after transformed tables',
      woff2(
        [filler('glyf', 40), filler('loca', 0), filler('hmtx', 12), named([win(1, 'Brand Sans')])],
        {
          transformed: ['glyf', 'loca', 'hmtx'],
        },
      ),
    ],
    ['a WOFF2 with a table of its own tag', woff2([filler('Zzzz'), named([win(1, 'Brand Sans')])])],
  ])('reads the family of %s', (_, bytes) => {
    expect(readFontFamily(bytes)).toBe('Brand Sans')
  })

  it.each<[string, NameRecord[], string]>([
    ['ID 16 before ID 1', [win(1, 'Brand'), win(16, 'Brand Sans')], 'Brand Sans'],
    ['ID 1 when there is no ID 16', [win(2, 'Bold'), win(1, 'Brand')], 'Brand'],
    ['platform 3 before platform 1', [mac(1, 'Mac Name'), win(1, 'Win Name')], 'Win Name'],
    ['platform 1 encoding 0 when there is no platform 3', [mac(1, 'Mac Name')], 'Mac Name'],
    ['Mac Roman letters above 127', [mac(1, 'Caf\x8e')], 'Café'],
    ['English on platform 3', [win(1, 'Deutsch', 0x0407), win(1, 'English')], 'English'],
    [
      'the first record when none is English',
      [win(1, 'Eins', 0x0407), win(1, 'Zwei', 0x040c)],
      'Eins',
    ],
    ['English on platform 1', [mac(1, 'Japanese', 11), mac(1, 'English')], 'English'],
    [
      'ID 16 on platform 1 before ID 1 on platform 3',
      [win(1, 'Brand'), mac(16, 'Brand Sans')],
      'Brand Sans',
    ],
    [
      'the text with control characters removed',
      [win(1, 'Brand\u0000\u0007\u001b Sans\u007f\u0085')],
      'Brand Sans',
    ],
    ['the text trimmed', [win(1, '  Brand Sans \t ')], 'Brand Sans'],
    ['the text cut to 100 characters', [win(1, 'x'.repeat(250))], 'x'.repeat(100)],
    [
      'a character outside the basic plane whole',
      [win(1, `${'x'.repeat(99)}\u{1F600}y`)],
      `${'x'.repeat(99)}\u{1F600}`,
    ],
    ['a lone surrogate as a replacement character', [win(1, 'A\uD800B')], 'A\uFFFDB'],
  ])('takes %s', (_, records, family) => {
    expect(readFontFamily(ttf(records))).toBe(family)
  })

  const noName = () => {
    const bytes = ttf([win(1, 'Brand Sans')])
    bytes.writeUInt32BE(bytes.length - 4, 12 + 16 + 12)
    return bytes
  }
  const stringPast = () => {
    const table = nameTable([win(1, 'Brand Sans')])
    table.writeUInt16BE(0xfff0, 6 + 10)
    return sfnt('ttf', [{ tag: 'name', data: table }])
  }
  const hugeCount = () =>
    sfnt('ttf', [{ tag: 'name', data: nameTable([win(1, 'Brand Sans')], 0xffff) }])
  const hugeTables = () => {
    const bytes = ttf([win(1, 'Brand Sans')])
    bytes.writeUInt16BE(0xffff, 4)
    return bytes
  }
  const woffWith = (edit: (b: Buffer) => void) => {
    const bytes = woff2([filler('head'), named([win(1, 'Brand Sans')])])
    edit(bytes)
    return bytes
  }
  const nameEntry = (b: Buffer) => b.indexOf(Buffer.from([5]), 48)

  it.each<[string, () => Uint8Array]>([
    ['empty bytes', () => new Uint8Array(0)],
    ['a few bytes', () => new Uint8Array([0, 1, 0])],
    ['bytes of another type', () => Buffer.from('%PDF-1.7 not a font at all')],
    ['a font with no name table', () => sfnt('ttf', [filler('head')])],
    ['a name table past the end', noName],
    ['a string past the end of the table', stringPast],
    ['a huge record count', hugeCount],
    ['a huge table count', hugeTables],
    [
      'no usable record',
      () => ttf([{ platform: 0, encoding: 3, language: 0, nameId: 1, text: 'U' }]),
    ],
    ['a family that is only spaces and controls', () => ttf([win(1, ' \u0001 ')])],
    ['a font collection', () => Buffer.concat([Buffer.from('ttcf'), Buffer.alloc(40)])],
    ['a WOFF2 header cut short', () => woffWith(() => undefined).subarray(0, 30)],
    ['a WOFF2 collection', () => woff2([named([win(1, 'B')])], { flavor: 'ttcf' })],
    ['a WOFF2 with no tables', () => woffWith((b) => b.writeUInt16BE(0, 12))],
    ['a WOFF2 with a huge table count', () => woffWith((b) => b.writeUInt16BE(0xffff, 12))],
    ['a WOFF2 stream past the end', () => woffWith((b) => b.writeUInt32BE(0xffffff, 20))],
    [
      'a WOFF2 length number past 32 bits',
      () => woffWith((b) => b.fill(0xff, nameEntry(b) + 1, nameEntry(b) + 7)),
    ],
    [
      'a WOFF2 length number longer than five bytes',
      () =>
        woffWith((b) => {
          b.fill(0x80, nameEntry(b) + 1, nameEntry(b) + 7)
          b.writeUInt8(0x81, nameEntry(b) + 1)
        }),
    ],
    [
      'a WOFF2 length with a leading zero',
      () => woffWith((b) => b.writeUInt8(0x80, nameEntry(b) + 1)),
    ],
    [
      'a WOFF2 stream that is not Brotli',
      () => woff2([named([win(1, 'B')])], { stream: Buffer.alloc(30, 0xff) }),
    ],
    [
      'a WOFF2 name table longer than its stream',
      () => woff2([named([win(1, 'B')])], { stream: oversizedStream(4) }),
    ],
    [
      'an over-large WOFF2',
      () => {
        const table = nameTable([win(1, 'B')])
        const stream = oversizedStream(33 * 1024 * 1024, table)
        return woff2([{ tag: 'name', data: table }], { stream })
      },
    ],
  ])('gives null, never an error, for %s', (_, make) => {
    expect(() => readFontFamily(make())).not.toThrow()
    expect(readFontFamily(make())).toBeNull()
  })
})
