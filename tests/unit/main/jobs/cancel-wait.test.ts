import { describe, it, expect } from 'vitest'
import { CLOSE_WAIT_MS, cancelWaitFor } from '@/main/jobs/cancel-wait'

describe('the cancel waits [SPEC 6.11.2 1.38, 14 1.38 Y6]', () => {
  it('waits 60 s for ComfyUI', () => {
    expect(cancelWaitFor('comfyui')).toBe(60_000)
  })

  it('waits 10 minutes for fal', () => {
    expect(cancelWaitFor('fal-seedance')).toBe(600_000)
  })

  it('waits 5 s for the fake provider', () => {
    expect(cancelWaitFor('fake')).toBe(5_000)
  })

  it('waits 60 s for any other provider', () => {
    expect(cancelWaitFor('gemini')).toBe(60_000)
    expect(cancelWaitFor('a-later-provider')).toBe(60_000)
  })

  it('a close waits at most 5 s', () => {
    expect(CLOSE_WAIT_MS).toBe(5_000)
  })
})
