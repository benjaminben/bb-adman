import { describe, it, expect } from 'vitest'
import { parseBrief } from '../../../../src/shared/brief/parse'
import { BRIEF_UNREADABLE } from '../../../../src/shared/brief/draft'
import { fill } from './slow-fill'

// SPEC 6.1 item 9 [1.33], 14 R1, security class: the three slow flow lists, timed at 16,384
// bytes and at the full limit, best of three runs each. Each is refused. The full size is
// under 5 seconds, and when it takes over 100 ms it takes at most 8 times the small size:
// time in step with size gives 4 (the full limit is 4 times 16 KiB), a square law gives 16,
// so 8 catches a path whose time grows faster than the file. The times are kept in the meta.
const SMALL_BYTES = 16_384
const BOUND_MS = 5_000
const RATIO_FROM_MS = 100
const MAX_RATIO = 8
const RUNS = 3
const TIMEOUT_MS = 30_000

const unreadable = { ok: false, error: BRIEF_UNREADABLE }

function bestTime(text: string): number {
  let best = Infinity
  for (let run = 0; run < RUNS; run += 1) {
    const start = performance.now()
    const result = parseBrief(text, 'yaml')
    const elapsed = performance.now() - start
    expect(result).toEqual(unreadable)
    best = Math.min(best, elapsed)
  }
  return best
}

describe('parseBrief YAML: slow flow lists grow in step with size [SPEC 6.1 item 9, 14 R1]', () => {
  it.for(['-', '- ', ','])('%j in a flow list', { timeout: TIMEOUT_MS }, (unit, { task }) => {
    const small = bestTime(fill('extra: [', () => unit, ']\n', ',', SMALL_BYTES))
    const full = bestTime(fill('extra: [', () => unit, ']\n', ','))
    Object.assign(task.meta, { smallMs: small, fullMs: full, ratio: full / small })
    expect(full).toBeLessThan(BOUND_MS)
    if (full > RATIO_FROM_MS) expect(full).toBeLessThanOrEqual(MAX_RATIO * small)
  })
})
