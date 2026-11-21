// CU-9 [REQ: FR-269]: polls and the live connection both say how far a run is. onProgress is
// called only when the stage, the queue position or the whole percent changed: each call is
// one database write and one job.updated event.
import { describe, expect, it } from 'vitest'
import type { RunProgress } from '@/main/providers/types'
import { progressReporter } from '@/main/providers/comfyui/progress'

type Step = [RunProgress, RunProgress | null]

describe('progressReporter [CU-9, spec/phases/phase-02-leftovers.md]', () => {
  it.each<[string, Step[]]>([
    [
      'the first report is passed on, the same one again is not',
      [
        [
          { stage: 'waiting', queuePosition: 2 },
          { stage: 'waiting', queuePosition: 2 },
        ],
        [{ stage: 'waiting', queuePosition: 2 }, null],
      ],
    ],
    [
      'a new queue position is passed on',
      [
        [
          { stage: 'waiting', queuePosition: 2 },
          { stage: 'waiting', queuePosition: 2 },
        ],
        [
          { stage: 'waiting', queuePosition: 1 },
          { stage: 'waiting', queuePosition: 1 },
        ],
      ],
    ],
    [
      'the whole percent decides: 41.2 then 41.9 is one call',
      [
        [
          { stage: 'working', fraction: 0.412 },
          { stage: 'working', fraction: 0.41 },
        ],
        [{ stage: 'working', fraction: 0.419 }, null],
        [
          { stage: 'working', fraction: 0.42 },
          { stage: 'working', fraction: 0.42 },
        ],
      ],
    ],
    [
      'a poll that says working keeps the percent the live connection gave',
      [
        [
          { stage: 'working', fraction: 0.5 },
          { stage: 'working', fraction: 0.5 },
        ],
        [{ stage: 'working' }, null],
        [
          { stage: 'working', fraction: 0.6 },
          { stage: 'working', fraction: 0.6 },
        ],
      ],
    ],
    [
      'a run that works does not go back to waiting on a late poll',
      [
        [
          { stage: 'waiting', queuePosition: 1 },
          { stage: 'waiting', queuePosition: 1 },
        ],
        [{ stage: 'working' }, { stage: 'working' }],
        [{ stage: 'waiting', queuePosition: 1 }, null],
      ],
    ],
    [
      'a fraction out of range is held to 0 to 100 percent',
      [
        [
          { stage: 'working', fraction: 1.7 },
          { stage: 'working', fraction: 1 },
        ],
        [
          { stage: 'working', fraction: -1 },
          { stage: 'working', fraction: 0 },
        ],
      ],
    ],
  ])('%s', (_name, steps) => {
    const calls: RunProgress[] = []
    const report = progressReporter((p) => calls.push(p))
    let expectedCount = 0
    for (const [given, passed] of steps) {
      report(given)
      if (passed) {
        expectedCount += 1
        expect(calls.at(-1)).toEqual(passed)
      }
      expect(calls).toHaveLength(expectedCount)
    }
  })

  it('does nothing when there is no onProgress', () => {
    expect(() => progressReporter(undefined)({ stage: 'working' })).not.toThrow()
  })
})
