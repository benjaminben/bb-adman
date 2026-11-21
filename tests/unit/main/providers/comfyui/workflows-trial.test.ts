import { describe, it, expect } from 'vitest'
import { WORKFLOWS } from '../../../../../src/main/providers/comfyui/workflows'
import { H3_VIDEO } from '../../../../../src/main/providers/comfyui/workflows/common'

describe('the workflow data step: video timing [SPEC 14 1.45 B-6]', () => {
  it('sets H3_VIDEO from the reference notes: 24 fps, counts of 17k + 5, 15 s at most', () => {
    expect(H3_VIDEO).toEqual({ fps: 24, frameStep: 17, frameOffset: 5, maxMs: 15_000 })
  })

  it('gives every video workflow those values', () => {
    for (const w of WORKFLOWS.filter((spec) => spec.job === 'video')) {
      expect(w.video, w.id).toEqual(H3_VIDEO)
    }
  })

  it('allows 56 frames, the length the test runs use (17 x 3 + 5)', () => {
    expect((56 - H3_VIDEO.frameOffset) % H3_VIDEO.frameStep).toBe(0)
  })
})
