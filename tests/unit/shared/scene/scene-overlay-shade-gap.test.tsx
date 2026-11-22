// Review fix (spec/phases/phase-08.md "Video", "Shade over video"): the export draws what the
// editor draws. In a gap of a video variant's background track the editor's clip track is an
// empty box with no shade, so overlay-only draws the shade only where a clip covers the time.
import './fake-fonts'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Scene } from '@/shared/scene/scene'
import type { SceneClip, SceneProps } from '@/shared/scene/types'
import type { Shade } from '@/shared/schemas/layer'
import { asset, layer, variant } from './fixtures'

const shade: Shade = { color: '#000000', from: 'bottom', strength: 0.8, reach: 0.6 }
const video = { ...variant, format: 'video' as const, durationMs: 3000 }
const bg = layer({
  id: 'bg',
  type: 'background',
  z: 0,
  source: { assetId: 'A1' },
  style: { opacity: 1, shade },
})
// One clip from 1,000 ms to 2,000 ms: gaps before and after it.
const clip: SceneClip = {
  id: 'c1',
  assetId: 'A1',
  startMs: 1000,
  inMs: 0,
  outMs: 1000,
  placement: null,
  soundOn: true,
}

function shadeAt(timeMs: number) {
  const props: SceneProps = {
    variant: video,
    layers: [bg],
    assets: { A1: asset() },
    clips: [clip],
    timeMs,
    mode: 'overlay-only',
  }
  const { container } = render(<Scene {...props} />)
  return container.querySelector('[data-shade-of="bg"]')
}

describe('the overlay-only shade follows the clip track [review fix]', () => {
  it.each([
    [500, 'in the gap before the clip', false],
    [1000, 'at the clip start', true],
    [1999, 'inside the clip', true],
    [2000, 'at the clip end, in the gap after it', false],
  ])('at %i ms (%s) the shade is drawn: %s', (timeMs, _, drawn) => {
    expect(shadeAt(timeMs) !== null).toBe(drawn)
  })

  it('with no clip on the track, no shade is drawn', () => {
    const { container } = render(
      <Scene variant={video} layers={[bg]} assets={{}} clips={[]} timeMs={0} mode="overlay-only" />,
    )
    expect(container.querySelector('[data-shade-of]')).toBeNull()
  })
})
