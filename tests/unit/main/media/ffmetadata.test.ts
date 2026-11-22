import { describe, expect, it } from 'vitest'
import { escapeMetadata, ffmetadataText } from '@/main/media/ffmetadata'

describe('ffmetadata escaping (phase-07.md, P7-4)', () => {
  it.each([
    ['=', 'a=b', 'a\\=b'],
    [';', 'a;b', 'a\\;b'],
    ['#', 'a#b', 'a\\#b'],
    ['\\', 'a\\b', 'a\\\\b'],
    ['a line break', 'a\nb', 'a\\\nb'],
    ['a carriage return', 'a\rb', 'a\\\rb'],
    ['an empty value', '', ''],
    ['non-ASCII text', 'Café — 夏', 'Café — 夏'],
    ['several at once', '{"a":"=;#"}', '{"a":"\\=\\;\\#"}'],
  ])('escapes %s', (_name, value, escaped) => {
    expect(escapeMetadata(value)).toBe(escaped)
  })

  it('writes the header line, then the comment', () => {
    expect(ffmetadataText('x=1')).toBe(';FFMETADATA1\ncomment=x\\=1\n')
  })

  // P7-16 (from the P7-4 review): FFmpeg ends a value at NUL, and no other control character
  // belongs in the details, so each is refused rather than written.
  it.each([
    ['NUL', 'a\u0000b'],
    ['a tab', 'a\tb'],
    ['an escape', 'a\u001bb'],
    ['a unit separator', 'a\u001fb'],
    ['a delete', 'a\u007fb'],
    ['a C1 control', 'a\u0085b'],
  ])('refuses %s', (_name, value) => {
    expect(() => escapeMetadata(value)).toThrow()
    expect(() => ffmetadataText(value)).toThrow()
  })
})
