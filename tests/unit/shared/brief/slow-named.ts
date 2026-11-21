import { MAX_BRIEF_BYTES } from '../../../../src/shared/config/brief-limits'
import { byteLength, fill } from './slow-fill'

// SPEC 14 Q4 [1.31], R2 [1.33], S2 [1.36]: the texts of the named timed cases, each just under the limit.

// Three letters, a different one for each i below 26^3.
const tag = (i: number): string =>
  [676, 26, 1].map((d) => String.fromCharCode(97 + (Math.floor(i / d) % 26))).join('')

const aliases = (name: string): string => Array<string>(50).fill(name).join(', ')
const n1Head = `extra: [&e [], &c [${aliases('*e')}], ${aliases('*c')}, `
const half = (MAX_BRIEF_BYTES - 16) / 2
const deepKeys = `extra: ${'['.repeat(1_500)}k]${': 1]'.repeat(1_499)}\n`

// R2 case 11: n levels are 'extra: k]\n', n times '[' and n - 1 times ': 1]', so the text has
// fixed + n * perLevel bytes. n is the largest that keeps it at or under the limit less 16.
const keysInKeys = (n: number): string => `extra: ${'['.repeat(n)}k]${': 1]'.repeat(n - 1)}\n`
const perLevel = byteLength('[: 1]')
const fixed = byteLength('extra: k]\n') - byteLength(': 1]')
const deepestKeys = keysInKeys(Math.floor((MAX_BRIEF_BYTES - 16 - fixed) / perLevel))

// R2 case 12: one unit is a key 10 lists deep.
export const tenLevelKey = `${'['.repeat(10)}k]${': 1]'.repeat(9)}`

export const namedCases: [string, string][] = [
  ['1. N1: aliases of a list of aliases', fill(n1Head, () => '1,', '1]\n')],
  [
    '2. N1, nested: the fill inside 200 nested lists',
    fill(`${n1Head}${'['.repeat(200)}`, () => '[],', `[]${']'.repeat(200)}]\n`),
  ],
  [
    '3. N2: anchors, then list keys, half the bytes each',
    fill('extra: [[', () => '&a 1', '], ', ',', half) + fill('{', () => '[]: 1', '}]\n', ',', half),
  ],
  ['4. list keys with no anchor', fill('extra: {', () => '[]: 1', '}\n', ',')],
  ['5. anchors with no alias', fill('extra: [', () => '&a 1', ']\n', ',')],
  [
    '6. N3: a long %TAG prefix, then a different tag on each item',
    fill(`%TAG ! tag:${'a'.repeat(half)}\n---\nextra: [`, (i) => `!${tag(i)} 1`, ']\n', ','),
  ],
  ['7. many tags, no %TAG line', fill('extra: [', (i) => `!${tag(i)} 1`, ']\n', ',')],
  ['8. one long tag', fill('extra: !<', () => 'a', '> 1\n')],
  [
    '9. keys inside keys, 20 levels',
    fill(`extra: ${'['.repeat(20)}`, () => 'k', `]${': 1]'.repeat(19)}\n`, ','),
  ],
  ['10. keys inside keys, 1,500 levels', fill(`${deepKeys}#`, () => 'a', '\n')],
  ['11. keys inside keys, as deep as fits', deepestKeys],
  ['12. many short keys inside keys, 10 levels', fill('extra: [', () => tenLevelKey, ']\n', ',')],
]
