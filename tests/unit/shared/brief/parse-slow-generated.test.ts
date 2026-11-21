import { describe, it, expect } from 'vitest'
import { parseBrief } from '@/shared/brief/parse'
import { BRIEF_UNREADABLE } from '@/shared/brief/draft'
import { BRIEF_TEST_BYTES as MAX_BRIEF_BYTES } from './test-size'
import { byteLength, fill } from './slow-fill'

// SPEC 6.1 item 9 [1.31], 14 Q4, security class: a fixed list of short units, each repeated
// to just under the limit in three ways. The outcome is not pinned: the call returns without
// throwing, gives a draft or brief_unreadable, and takes less than the bound. The list is
// fixed, not random, so a slow case can be run again. The time is kept in the test's meta.
const BOUND_MS = 5_000
const TIMEOUT_MS = 30_000

const oneCharacter = [...'[]{},:?-#|>"\'!&*%\\.~', ' ', '\t', '\r', '\uFEFF']
const longer = [
  '\r\n',
  '- ',
  '? ',
  ': ',
  'a: ',
  'a: [',
  '{a: ',
  '[a: ',
  '? [',
  '- - ',
  '---',
  '...',
  '"\\',
  "''",
  '|\n ',
  '>-\n',
  '!a ',
  '!<a> ',
  '!!a ',
  '&a ',
  '*a ',
  '# a',
  'a #',
  '\u20AC',
  'a',
  '0x',
  '1e',
  'a: !a ',
]
const units = [...oneCharacter, ...longer]

const shapes: [string, (unit: string) => string][] = [
  ['nothing between', (unit) => fill('', () => unit, '')],
  ['one per line', (unit) => fill('', () => `${unit}\n`, '')],
  ['in a flow list', (unit) => fill('extra: [', () => unit, ']\n', ',')],
]

const cases: [string, string][] = shapes.flatMap(([shape, make]) =>
  units.map((unit): [string, string] => [`${JSON.stringify(unit)}, ${shape}`, make(unit)]),
)

describe('parseBrief YAML: generated worst cases return quickly [SPEC 6.1 item 9, 14 Q4]', () => {
  it('has the 52 fixed units in three shapes', () => {
    expect(units).toHaveLength(52)
    expect(cases).toHaveLength(156)
  })

  it.for(cases)('%s', { timeout: TIMEOUT_MS }, ([, text], { task }) => {
    expect(byteLength(text)).toBeGreaterThan(MAX_BRIEF_BYTES - 64)
    expect(byteLength(text)).toBeLessThanOrEqual(MAX_BRIEF_BYTES)
    const start = performance.now()
    const result = parseBrief(text, 'yaml')
    const elapsed = performance.now() - start
    Object.assign(task.meta, { elapsedMs: elapsed })
    if (!result.ok) expect(result.error).toEqual(BRIEF_UNREADABLE)
    expect(elapsed).toBeLessThan(BOUND_MS)
  })
})
