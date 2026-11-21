import { describe, it, expect } from 'vitest'
import { parseBrief } from '../../../../src/shared/brief/parse'
import { BRIEF_UNREADABLE } from '../../../../src/shared/brief/draft'
import { MAX_BRIEF_BYTES } from '../../../../src/shared/config/brief-limits'
import { byteLength } from './slow-fill'

// SPEC 6.1 item 9 [1.36] "Two square-law paths in the parser", 14 S3, security class. These
// shapes are slow in the library's parser, before any check of ours; the limit is what bounds
// them. The texts are worked out from the limit. The order of the calls catches a slow-down
// that carries over from one file to the next: text 4 comes right after text 1 on purpose.
const L = MAX_BRIEF_BYTES
const BOUND_MS = 2_000
const TIMEOUT_MS = 30_000

const read = { ok: true, data: {} }
const unreadable = { ok: false, error: BRIEF_UNREADABLE }

const blankThenComments = (room: number, blank: number): string =>
  '- x\n' + '\n'.repeat(blank) + '-\n' + ' #\n'.repeat(Math.floor((room - 6 - blank) / 3))

const d = Math.floor(L / 4)

type Case = [string, string, object]

const text1: Case = [
  '1. deep list, then blank lines',
  '- '.repeat(d) + 'x\n' + '\n'.repeat(L - 2 * d - 2),
  unreadable,
]
const text2: Case = [
  '2. blank lines, one dash, comments',
  blankThenComments(L, Math.floor((L - 6) / 2)),
  unreadable,
]
const text3: Case = [
  '3. the same under a key',
  'extra:\n' + blankThenComments(L - 7, Math.floor((L - 13) / 2)),
  read,
]
const text4: Case = [
  '4. fewer blank lines, more comments, under a key',
  'extra:\n' + blankThenComments(L - 7, Math.floor(L / 4)),
  read,
]

const texts = [text1, text2, text3, text4]
const sequence = [text1, text4, text2, text3, text1, text4, text2, text3]

describe("parseBrief YAML: the parser's two slow shapes [SPEC 6.1 item 9, 14 S3]", () => {
  it('each text is at the limit', () => {
    for (const [, text] of texts) {
      expect(byteLength(text)).toBeGreaterThan(L - 8)
      expect(byteLength(text)).toBeLessThanOrEqual(L)
    }
  })

  it(
    'one after another in one process, twice round, each call under 2,000 ms',
    { timeout: TIMEOUT_MS },
    ({ task }) => {
      const times: [string, number][] = []
      for (const [name, text, expected] of sequence) {
        const start = performance.now()
        const result = parseBrief(text, 'yaml')
        const elapsed = performance.now() - start
        times.push([name, elapsed])
        Object.assign(task.meta, { times })
        expect(result).toEqual(expected)
        expect(elapsed).toBeLessThan(BOUND_MS)
      }
    },
  )
})
