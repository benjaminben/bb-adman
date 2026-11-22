// P8-17, from the review of video export: the encode's time limit is a minute and a second per
// frame, capped at the largest timer Node accepts, so a very long ad is not killed at once
// (a larger value makes setTimeout fire after 1 ms).
import { describe, expect, it } from 'vitest'
import { encodeTimeLimitMs } from '@/main/export/video/video-ad'

const LARGEST_TIMER_MS = 2 ** 31 - 1

describe('encodeTimeLimitMs [P8-17]', () => {
  it.each([
    [0, 60_000],
    [60, 120_000],
    [2_000_000, 2_000_060_000],
    [3_000_000, LARGEST_TIMER_MS],
    [Number.MAX_SAFE_INTEGER, LARGEST_TIMER_MS],
  ])('%i frames give %i ms', (frames, limit) => {
    expect(encodeTimeLimitMs(frames)).toBe(limit)
  })
})
