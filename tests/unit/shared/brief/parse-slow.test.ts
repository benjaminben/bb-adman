import { describe, it, expect } from 'vitest'
import { parseBrief } from '../../../../src/shared/brief/parse'
import { BRIEF_UNREADABLE } from '../../../../src/shared/brief/draft'
import { MAX_BRIEF_BYTES } from '../../../../src/shared/config/brief-limits'
import { byteLength, fill } from './slow-fill'
import { namedCases } from './slow-named'

// SPEC 6.1 item 7 [1.26], 14 P3, security class: worst-case files just under the limit
// return in under 5 seconds, timed around the one call. The bound is wide on purpose; the
// test's own timeout is 30 seconds so a slow parse fails on the time and does not hang.
const BOUND_MS = 5_000
const TIMEOUT_MS = 30_000

const key = (i: number): string => `k${i.toString(36)}`
const read = { ok: true, data: {} }
const unreadable = { ok: false, error: BRIEF_UNREADABLE }

const cases: [string, 'yaml' | 'json', string, object][] = [
  ['YAML, a flow mapping of different short keys', 'yaml', fill('extra: {', key, '}\n', ','), read],
  [
    'YAML, a block mapping of different short keys',
    'yaml',
    fill('extra:\n', (i) => `  ${key(i)}: 1\n`, ''),
    read,
  ],
  [
    'YAML, &a 1,*a, repeated in a list',
    'yaml',
    fill('extra: [', () => '&a 1,*a,', ']\n'),
    unreadable,
  ],
  [
    'YAML, &a 1,&c [*a],*c, repeated in a list',
    'yaml',
    fill('extra: [', () => '&a 1,&c [*a],*c,', ']\n'),
    unreadable,
  ],
  ['YAML, a file of faulty lines', 'yaml', fill('', (i) => `${key(i)}: [}\n`, ''), unreadable],
  [
    'JSON, an object of different short keys',
    'json',
    fill('{"extra":{', (i) => `"${key(i)}":1`, '}}', ','),
    read,
  ],
]

describe('parseBrief: worst-case files return quickly [SPEC 6.1 item 7, 14 P3]', () => {
  it.each(cases)(
    '%s',
    (_name, syntax, text, expected) => {
      expect(new TextEncoder().encode(text).length).toBeGreaterThan(MAX_BRIEF_BYTES - 64)
      expect(text.length).toBeLessThanOrEqual(MAX_BRIEF_BYTES)
      const start = performance.now()
      const result = parseBrief(text, syntax)
      const elapsed = performance.now() - start
      expect(result).toEqual(expected)
      expect(elapsed).toBeLessThan(BOUND_MS)
    },
    TIMEOUT_MS,
  )
})

// SPEC 6.1 item 9, 14 Q4 and R2, security class: the named cases. Each is refused but 7
// (unknown tags are read as plain data, 1.25) and 8 (observed: the long verbatim tag is read
// the same way). The time is kept in the test's meta so a run can report it.
const namedOutcome = (name: string): object => (/^[78]\./.test(name) ? read : unreadable)

describe('parseBrief YAML: the named worst cases return quickly [SPEC 6.1 item 9, 14 Q4]', () => {
  it.for(namedCases)('%s', { timeout: TIMEOUT_MS }, ([name, text], { task }) => {
    expect(byteLength(text)).toBeGreaterThan(MAX_BRIEF_BYTES - 64)
    expect(byteLength(text)).toBeLessThanOrEqual(MAX_BRIEF_BYTES)
    const start = performance.now()
    const result = parseBrief(text, 'yaml')
    const elapsed = performance.now() - start
    Object.assign(task.meta, { elapsedMs: elapsed })
    expect(result).toEqual(namedOutcome(name))
    expect(elapsed).toBeLessThan(BOUND_MS)
  })
})
