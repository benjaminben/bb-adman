import { describe, it, expect } from 'vitest'
import { cleanLineText } from '@/shared/brief/bad-line'

// Characters written by number, so no invisible mark sits in this file.
const ch = (...points: number[]) => String.fromCodePoint(...points)

// SP-1 review Note 4: marks that draw nothing or hide text are removed from shown lines.
describe('cleanLineText removes characters that draw nothing [SP-1 review]', () => {
  it.each([
    ['the Arabic letter mark', 0x061c],
    ['the soft hyphen', 0x00ad],
    ['the combining grapheme joiner', 0x034f],
    ['the Hangul choseong filler', 0x115f],
    ['the Hangul jungseong filler', 0x1160],
    ['the Hangul filler', 0x3164],
    ['the halfwidth Hangul filler', 0xffa0],
    ['the Mongolian vowel separator', 0x180e],
    ['the first variation selector', 0xfe00],
    ['the emoji variation selector', 0xfe0f],
    ['the first tag character', 0xe0000],
    ['the language tag', 0xe0001],
    ['a tag letter', 0xe0061],
    ['the cancel tag', 0xe007f],
  ])('removes %s (U+%s)', (_name, point) => {
    expect(cleanLineText(`a${ch(point)}b.png`)).toBe('ab.png')
  })

  it.each([
    ['a letter before the Hangul fillers', 0x115e],
    ['a letter after the variation selectors', 0xfe10],
    ['a character after the tags', 0xe0080],
  ])('keeps %s', (_name, point) => {
    expect(cleanLineText(`a${ch(point)}b`)).toBe(`a${ch(point)}b`)
  })
})
