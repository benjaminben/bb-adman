import { describe, it, expect } from 'vitest'
import { EVENT_NAMES } from '@/shared/schemas/events'

describe('events [SPEC 4.4; SPEC 14 1.29 T3, 1.39 Z2]', () => {
  it('lists asset.changedOnDisk', () => {
    expect(EVENT_NAMES).toContain('asset.changedOnDisk')
  })
})
