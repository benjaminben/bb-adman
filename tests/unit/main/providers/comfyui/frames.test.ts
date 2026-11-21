import { describe, it, expect } from 'vitest'
import { frameCount } from '../../../../../src/main/providers/comfyui/frames'
import { H3_VIDEO } from '../../../../../src/main/providers/comfyui/workflows/common'
import { VIDEO_WORK_MS } from '../../../../../src/main/providers/comfyui/limits'

describe('frameCount [SPEC 6.10.7, 14 1.45 B-6]', () => {
  it('gives 56 frames for two seconds of H3', () => {
    expect(frameCount(2_000, H3_VIDEO)).toBe(56)
  })

  it('always gives a count of the form frameStep x k + frameOffset', () => {
    for (let ms = 0; ms <= 20_000; ms += 250) {
      const n = frameCount(ms, H3_VIDEO)
      expect((n - H3_VIDEO.frameOffset) % H3_VIDEO.frameStep).toBe(0)
      expect(n).toBeGreaterThanOrEqual(H3_VIDEO.frameOffset)
    }
  })

  it('moves to the nearest allowed count of round(seconds x fps)', () => {
    // 1 s is 24 frames: 22 is nearer than 39.
    expect(frameCount(1_000, H3_VIDEO)).toBe(22)
    // 3 s is 72 frames: 73 is nearer than 56.
    expect(frameCount(3_000, H3_VIDEO)).toBe(73)
    expect(frameCount(0, H3_VIDEO)).toBe(5)
  })

  it('is never above the largest allowed count that fits maxMs', () => {
    // 15 s at 24 fps is 360 frames; the largest 17k + 5 not above it is 345.
    expect(frameCount(15_000, H3_VIDEO)).toBe(345)
    expect(frameCount(60_000, H3_VIDEO)).toBe(345)
  })
})

describe('the video working limit [SPEC 14 1.43 K-3]', () => {
  it('is 120 minutes', () => {
    expect(VIDEO_WORK_MS).toBe(120 * 60_000)
  })
})
