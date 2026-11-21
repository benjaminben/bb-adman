import { describe, it, expect } from 'vitest'
import { WORKFLOWS } from '@/main/providers/comfyui/workflows'
import {
  H3_FIRST_RUN_SIZE,
  H3_FULL_SIZE,
  H3_VIDEO,
  MOSS_FIRST_RUN_SIZE,
  MOSS_FULL_SIZE,
} from '@/main/providers/comfyui/workflows/common'
import { fitSize } from '@/shared/comfy/fit-size'

describe('the workflow data step: start small [SPEC 14 1.46, "Workflow data"]', () => {
  it('keeps the full sizes of SPEC 6.10.5 under their own names', () => {
    expect(MOSS_FULL_SIZE).toEqual({ multiple: 16, minPixels: 1_000_000, maxPixels: 2_000_000 })
    expect(H3_FULL_SIZE).toEqual({ multiple: 32, minPixels: 589_824, maxPixels: 1_048_576 })
  })

  it('sets the first-run sizes at the templates figures', () => {
    expect(MOSS_FIRST_RUN_SIZE).toEqual({ multiple: 16, minPixels: 840_000, maxPixels: 1_050_000 })
    expect(H3_FIRST_RUN_SIZE).toEqual({ multiple: 32, minPixels: 330_000, maxPixels: 420_000 })
  })

  it('keeps every draft at its full size', () => {
    for (const w of WORKFLOWS.filter((spec) => spec.status === 'draft')) {
      expect(w.size, w.id).toBe(w.job === 'video' ? H3_FULL_SIZE : MOSS_FULL_SIZE)
    }
  })

  it.each([
    [1080, 1080, 1024, 1024, 640, 640],
    [1080, 1920, 768, 1360, 480, 864],
    [1920, 1080, 1360, 768, 864, 480],
    [1080, 1350, 912, 1136, 576, 704],
  ])(
    'fits %i x %i to MOSS %i x %i and H3 %i x %i under the first-run rules',
    (width, height, mw, mh, hw, hh) => {
      expect(fitSize({ width, height }, MOSS_FIRST_RUN_SIZE)).toEqual({ width: mw, height: mh })
      expect(fitSize({ width, height }, H3_FIRST_RUN_SIZE)).toEqual({ width: hw, height: hh })
    },
  )
})

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
