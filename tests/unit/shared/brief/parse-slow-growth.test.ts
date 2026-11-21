import { describe, it, expect } from 'vitest'
import { parseBrief } from '../../../../src/shared/brief/parse'
import { BRIEF_UNREADABLE } from '../../../../src/shared/brief/draft'
import { MAX_BRIEF_BYTES } from '../../../../src/shared/config/brief-limits'
import { fill } from './slow-fill'

// SPEC 6.1 item 9 [1.33, 1.36], 14 R1, S2: the three slow flow lists, timed at a quarter of
// the limit and at the full limit, best of three each. Each is refused. Time in step with
// size gives 4 and a square law gives 16, so 8 catches a compose path that grows faster than
// the file. Since 1.36 this is a check on compose only, not a stop rule. Times are in the meta.
const SMALL_BYTES = MAX_BRIEF_BYTES / 4
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
