// CW-7 (from the CW-3 review): the edges of frameCount for the video values a custom workflow
// may have (spec/comfyui-custom.md "The stored shape": frameStep 1 to 64, frameOffset 0 to 64).
import { describe, it, expect } from 'vitest'
import { frameCount } from '@/main/providers/comfyui/frames'
import type { WorkflowVideo } from '@/shared/schemas/queries/comfy'

const video = (over: Partial<WorkflowVideo>): WorkflowVideo => ({
  fps: 24,
  maxMs: 5_000,
  frameStep: 4,
  frameOffset: 1,
  ...over,
})

describe('frameCount at its edges [CW-7]', () => {
  it('never gives fewer frames than one step when the offset is 0', () => {
    const v = video({ frameOffset: 0 })
    expect(frameCount(0, v)).toBe(4)
    expect(frameCount(40, v)).toBe(4)
    expect(frameCount(1_000, v)).toBe(24)
  })

  it('keeps the offset alone as the fewest frames when the offset is above 0', () => {
    expect(frameCount(0, video({ frameOffset: 1 }))).toBe(1)
  })

  it('never gives more frames than maxMs allows', () => {
    const v = video({ fps: 1, maxMs: 2_000, frameStep: 1, frameOffset: 0 })
    expect(frameCount(60_000, v)).toBe(2)
    for (let ms = 0; ms <= 60_000; ms += 500) {
      const n = frameCount(ms, video({ fps: 7, maxMs: 3_000, frameStep: 5, frameOffset: 2 }))
      expect(n).toBeLessThanOrEqual(21)
      expect(n).toBeGreaterThanOrEqual(2)
    }
  })

  it('stops with an error when no count the workflow takes fits maxMs', () => {
    // One second at 1 fps is one frame; the fewest this workflow takes is 5.
    expect(() => frameCount(1_000, video({ fps: 1, maxMs: 1_000, frameOffset: 5 }))).toThrow(Error)
    // With offset 0 the fewest is one step of 64, above the 1 frame allowed.
    const wide = video({ fps: 1, maxMs: 1_000, frameStep: 64, frameOffset: 0 })
    expect(() => frameCount(1_000, wide)).toThrow(Error)
  })
})
