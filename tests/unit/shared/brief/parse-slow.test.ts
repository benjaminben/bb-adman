import { describe, it, expect } from 'vitest'
import { parseBrief } from '../../../../src/shared/brief/parse'
import { BRIEF_UNREADABLE } from '../../../../src/shared/brief/draft'
import { MAX_BRIEF_BYTES } from '../../../../src/shared/config/brief-limits'

// SPEC 6.1 item 7 [1.26], 14 P3, security class: worst-case files just under the limit
// return in under 5 seconds, timed around the one call. The bound is wide on purpose; the
// test's own timeout is 30 seconds so a slow parse fails on the time and does not hang.
const BOUND_MS = 5_000
const TIMEOUT_MS = 30_000

// Repeats `unit` between `head` and `tail` while the text stays under the limit.
function fill(head: string, unit: (i: number) => string, tail: string, sep = ''): string {
  const parts: string[] = []
  let length = head.length + tail.length
  for (let i = 0; ; i += 1) {
    const part = (i > 0 ? sep : '') + unit(i)
    if (length + part.length > MAX_BRIEF_BYTES - 16) break
    parts.push(part)
    length += part.length
  }
  return head + parts.join('') + tail
}

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
