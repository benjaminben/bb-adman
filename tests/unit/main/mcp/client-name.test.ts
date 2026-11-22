// P10-8 (spec/phases/phase-10.md, A-242): the agent's client name is text the agent chose. It is
// cleaned as the ask's target names are (one shared cleaner), so it cannot break the dialog's
// line, the activity line or a log line: no control, format, line-break or reordering
// character, one space for each run of white space, `'` for every quote-like mark, at most two
// combining marks in a row, a cut at 60 code points, and null for nothing left.
import { describe, expect, it } from 'vitest'
import { cleanClientName } from '@/main/mcp/client-name'

const SIXTY = 'B'.repeat(60)

describe('cleanClientName [P10-8; A-242]', () => {
  it.each([
    ['keeps a plain name', 'Made-up Client', 'Made-up Client'],
    ['removes control characters', 'Made\u0000up\u0007 \u001bClient\u007f', 'Madeup Client'],
    ['removes reordering characters', '\u202eMade\u202d up\u2066\u2069\u200e\u200f', 'Made up'],
    ['removes zero-width characters', 'Ma\u200bde\u200c-\u200dup\ufeff', 'Made-up'],
    ['removes line breaks', 'Made\nup\r\nClient\u2028\u2029', 'MadeupClient'],
    [
      'collapses each run of white space to one space',
      'Made \t   up\u00a0\u2003 Client',
      'Made up Client',
    ],
    ['trims the ends', '   Made-up Client   ', 'Made-up Client'],
    ['turns a straight double quote into a single one', 'Say "yes"', "Say 'yes'"],
    ['turns curly quotes and guillemets into single ones', '“a” ‘b’ «c»', "'a' 'b' 'c'"],
    ['turns the look-alike quotes into single ones', '＂″‶〃〝〞〟״˝„‟', "'''''''''''"],
    ['keeps at most two combining marks in a row', 'e\u0301\u0302\u0303\u0304x', 'e\u0301\u0302x'],
    ['keeps a name of exactly 60 code points whole', SIXTY, SIXTY],
    ['cuts 61 code points at 60 and marks the cut', `${SIXTY}C`, `${SIXTY}…`],
    ['counts code points, not UTF-16 units', '😀'.repeat(61), `${'😀'.repeat(60)}…`],
  ])('%s', (_rule, raw, clean) => {
    expect(cleanClientName(raw)).toBe(clean)
  })

  it.each([
    ['an empty name', ''],
    ['white space only', ' \t\n '],
    ['only removed characters', '\u202e\u200b\u0000'],
    ['no name', undefined],
    ['a name that is not text', 7],
    ['an object', { name: 'Made-up Client' }],
  ])('gives null for %s', (_case, raw) => {
    expect(cleanClientName(raw)).toBeNull()
  })
})
