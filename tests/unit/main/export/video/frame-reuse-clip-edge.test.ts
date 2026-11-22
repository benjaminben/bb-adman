// Review fix: the overlay draws the background's shade only where a clip covers the time, so a
// frame on either side of a clip's start or end is drawn again, never reused.
import { describe, expect, it } from 'vitest'
import { frameReuse } from '@/main/export/video/frame-reuse'
import type { SceneClip } from '@/shared/scene/types'
import { layer } from '../../../shared/scene/fixtures'

const video = {
  width: 400,
  height: 400,
  language: 'en',
  format: 'video' as const,
  durationMs: 2000,
}
const bg = layer({ id: 'bg', type: 'background', z: 0, style: { opacity: 1 } })
// From 500 ms (frame 15 at 30 fps) to 1,000 ms (frame 30).
const clip: SceneClip = {
  id: 'c1',
  assetId: 'A1',
  startMs: 500,
  inMs: 0,
  outMs: 500,
  placement: null,
  soundOn: true,
}

function drawn(clips: SceneClip[] | undefined): number[] {
  const same = frameReuse({ variant: video, layers: [bg], clips }, 30)
  return Array.from({ length: 60 }, (_, i) => i).filter((i) => i > 0 && !same(i))
}

describe('frameReuse at a clip edge [review fix]', () => {
  it('draws the first frame inside a clip and the first frame after it', () => {
    expect(drawn([clip])).toEqual([15, 30])
  })

  it('reuses every frame when the track has no clip', () => {
    expect(drawn([])).toEqual([])
    expect(drawn(undefined)).toEqual([])
  })

  it('reuses frames inside one clip and inside one gap', () => {
    const same = frameReuse({ variant: video, layers: [bg], clips: [clip] }, 30)
    expect([5, 20, 40].map(same)).toEqual([true, true, true])
  })
})
