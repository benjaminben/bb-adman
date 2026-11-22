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
})
