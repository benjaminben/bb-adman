// P8-14 (spec/export-and-checks.md "Video variant", step 1) [REQ: FR-131]: the frame count and
// each frame's time come from the frame number, never from a clock.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { frameCount, frameTimeMs } from '@/shared/export/frames'

afterEach(() => vi.restoreAllMocks())

describe('frameCount [FR-131]', () => {
  it.each([
    { durationMs: 0, fps: 30, frames: 0 },
    { durationMs: 1000, fps: 30, frames: 30 },
    { durationMs: 1001, fps: 30, frames: 31 },
    { durationMs: 2000, fps: 30, frames: 60 },
    { durationMs: 15000, fps: 60, frames: 900 },
  ])('$durationMs ms at $fps fps is $frames frames', ({ durationMs, fps, frames }) => {
    expect(frameCount(durationMs, fps)).toBe(frames)
  })
})

describe('frameTimeMs [FR-131]', () => {
  it.each([
    { i: 0, fps: 30, ms: 0 },
    { i: 30, fps: 30, ms: 1000 },
    { i: 60, fps: 60, ms: 1000 },
    { i: 3, fps: 60, ms: 50 },
  ])('frame $i at $fps fps is drawn at $ms ms', ({ i, fps, ms }) => {
    expect(frameTimeMs(i, fps)).toBe(ms)
  })

  it('draws frame 7 at 30 fps at 233.33... ms', () => {
    expect(frameTimeMs(7, 30)).toBeCloseTo(7000 / 30, 10)
  })

  it('never reads a clock', () => {
    const now = vi.spyOn(Date, 'now')
    const perf = vi.spyOn(performance, 'now')
    frameCount(15000, 60)
    for (let i = 0; i < 900; i++) frameTimeMs(i, 60)
    expect(now).not.toHaveBeenCalled()
    expect(perf).not.toHaveBeenCalled()
  })
})
