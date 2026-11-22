import { describe, it, expect } from 'vitest'
import { parseBriefText } from '@/shared/brief/text'
import { BRIEF_TEST_BYTES as MAX_BRIEF_BYTES } from './test-size'
import { byteLength, fill } from './slow-fill'
import { namedCases } from './slow-named'

// Round 2 plan R2P-2: the timed rule of parse-slow applies to Markdown too. Each text is just
// under 16,384 bytes and goes through all three readers; the one call returns a result, never
// throws, in under 5 seconds. The outcome is not pinned.
const BOUND_MS = 5_000
const TIMEOUT_MS = 30_000

const key = (i: number): string => i.toString(36)

const units = [
  '#',
  '# ',
  '## ',
  '###### a\n',
  '*',
  '**',
  '__',
  ':',
  ' ',
  '\n',
  '\r\n',
  '- ',
  '- - ',
  '1. ',
  '(',
  ')',
  '```\n',
  '~~~\n',
  '**:',
  '**a**',
  'Region:',
  'Languages: a,',
  ',',
  '## Message\na\n\n',
  '## Subjects\n- a\n',
  '## Subjects\n### a\n',
]

const repeated: [string, string][] = units.flatMap((unit): [string, string][] => [
  [`${JSON.stringify(unit)} repeated`, fill('', () => unit, '')],
  [`${JSON.stringify(unit)} repeated after a heading`, fill('# Spring\n', () => unit, '')],
])

const distinct: [string, string][] = [
  ['many Copy sections', fill('', (i) => `## Copy (${key(i)})\nHeadline: a\n`, '')],
  ['many word lists', fill('', (i) => `Required words (${key(i)}): a\n`, '')],
  ['many subjects', fill('## Subjects\n', (i) => `### ${key(i)}\nPictures: a, b\n`, '')],
  ['many items', fill('Languages:\n', (i) => `- ${key(i)}\n`, '')],
  ['one long label line', fill('Languages: ', () => 'a,', '')],
  ['one long Message', fill('## Message\n', (i) => `w${key(i)} `, '')],
  ['one long space run', fill('Region', () => ' ', ': a')],
  ['one long bold label', fill('**', () => 'a', ':** b')],
  ['one long open bold', fill('**', () => 'a ', '')],
  ['one long open bracket', fill('Required words ', () => '(', ': a')],
]

describe('parseBriefText: worst-case texts return quickly [R2P-2, parse-slow]', () => {
  it.for([...repeated, ...distinct, ...namedCases])(
    '%s',
    { timeout: TIMEOUT_MS },
    ([, text], { task }) => {
      expect(byteLength(text)).toBeGreaterThan(MAX_BRIEF_BYTES - 64)
      expect(byteLength(text)).toBeLessThanOrEqual(MAX_BRIEF_BYTES)
      const start = performance.now()
      const result = parseBriefText(text)
      const elapsed = performance.now() - start
      Object.assign(task.meta, { elapsedMs: elapsed })
      expect(typeof result.ok).toBe('boolean')
      expect(elapsed).toBeLessThan(BOUND_MS)
    },
  )
})
