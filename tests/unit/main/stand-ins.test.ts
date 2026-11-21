import { describe, it, expect } from 'vitest'
import { createJobServiceStandIn } from '../../../src/main/jobs/stand-in'
import type { ProjectContext } from '../../../src/main/commands/types'

describe('JobService stand-in [SPEC 14, step 0]', () => {
  it('throws on enqueue and counts no active job', () => {
    const jobs = createJobServiceStandIn()
    expect(() =>
      jobs.enqueue({} as ProjectContext, {
        kind: 'image_generation',
        campaignId: null,
        variantId: null,
        layerId: null,
        slot: 'background',
        provider: 'fake',
        model: 'm',
        request: {},
      }),
    ).toThrow()
    expect(jobs.activeCount('p1')).toBe(0)
  })
})
