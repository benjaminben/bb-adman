import { describe, it, expect } from 'vitest'
import { badLineAt } from '../../../../src/shared/brief/bad-line'
import { MAX_BAD_LINE_CHARS } from '../../../../src/shared/config/brief-limits'

// Characters written by number, so no invisible mark sits in this file.
const ch = (...points: number[]) => String.fromCodePoint(...points)
const smile = ch(0x1f600)

// SPEC 14 1.39 "The YAML message" (security class): the first bad line, numbered and cleaned.
describe('badLineAt: the line number [SPEC 14 1.39 The YAML message]', () => {
  it('counts lines ended by \\n', () => {
    const body = 'region: US\nname: ok\nkey: value: other\n'
    expect(badLineAt(body, body.indexOf('value'))).toEqual({ line: 3, text: 'key: value: other' })
  })

  it('counts lines ended by \\r\\n and drops the \\r', () => {
    const body = 'region: US\r\nname: ok\r\nkey: value: other\r\n'
    expect(badLineAt(body, body.indexOf('value'))).toEqual({ line: 3, text: 'key: value: other' })
  })

  it('gives line 1 for an offset of 0', () => {
    expect(badLineAt('oops: [\n', 0)).toEqual({ line: 1, text: 'oops: [' })
  })

  it('reads an offset at the very end as the last line', () => {
    const body = 'region: US\nname: "open'
    expect(badLineAt(body, body.length)).toEqual({ line: 2, text: 'name: "open' })
  })

  it('reads an offset past the end as the last line', () => {
    const body = 'region: US\nname: "open'
    expect(badLineAt(body, body.length + 10)).toEqual({ line: 2, text: 'name: "open' })
  })

  it('gives an empty text for an empty line', () => {
    expect(badLineAt('region: US\n\nname: ok\n', 11)).toEqual({ line: 2, text: '' })
  })
})

describe('badLineAt: the line text is cleaned [SPEC 14 1.39 The YAML message]', () => {
  it('turns a tab into one space', () => {
    expect(badLineAt('key:\tvalue', 0).text).toBe('key: value')
  })

  it('removes control characters', () => {
    expect(badLineAt(`key: a${ch(0x07)}b${ch(0x9b)}c${ch(0x7f)}d`, 0).text).toBe('key: abcd')
  })

  it('removes a right-to-left override and other reordering or hidden marks', () => {
    const text = `key: a${ch(0x202e)}b${ch(0x200b)}c${ch(0x2066)}d${ch(0x2069)}e${ch(0x2028)}f`
    expect(badLineAt(text, 0).text).toBe('key: abcdef')
  })

  it('removes a byte-order mark inside the line', () => {
    expect(badLineAt(`key: a${ch(0xfeff)}b`, 0).text).toBe('key: ab')
  })

  it('removes a lone surrogate and keeps a full pair', () => {
    const text = `key: a${String.fromCharCode(0xd800)}b${String.fromCharCode(0xdc00)}c${smile}`
    expect(badLineAt(text, 0).text).toBe(`key: abc${smile}`)
  })

  it('trims the end', () => {
    expect(badLineAt('key: value   \t', 0).text).toBe('key: value')
  })

  it('cuts a 200-character line to 120 code points, not splitting a pair, and adds …', () => {
    const line = 'x'.repeat(119) + smile + 'y'.repeat(80)
    expect(MAX_BAD_LINE_CHARS).toBe(120)
    expect(badLineAt(line, 0).text).toBe('x'.repeat(119) + smile + '…')
  })

  it('adds no … to a line of exactly 120 code points', () => {
    const line = 'z'.repeat(120)
    expect(badLineAt(line, 0).text).toBe(line)
  })
})
