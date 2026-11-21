import { describe, it, expect } from 'vitest'
import { AGENT_MAX_ACTIVE_RUNS } from '../../../../src/shared/config/agent-runs'

describe('agent run limits [SPEC 6.11.3, CQ-20 default]', () => {
  it('lets an agent hold at most 4 queued or running jobs per provider', () => {
    expect(AGENT_MAX_ACTIVE_RUNS).toBe(4)
  })
})
