import { describe, it, expect, expectTypeOf } from 'vitest'
import { EVENT_NAMES, type EventMap } from '../../../../src/shared/schemas/events'
import type { JobRow } from '../../../../src/shared/schemas/rows/job'

describe('events [SPEC 4.4, 12, step 0 fix F4]', () => {
  it('lists job.updated, whose payload is a JobRow', () => {
    expect(EVENT_NAMES).toContain('job.updated')
    expectTypeOf<EventMap['job.updated']>().toEqualTypeOf<JobRow>()
  })
})
