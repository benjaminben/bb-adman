// P8-17, A-202 (spec/phases/phase-08.md "Video", "Shade over video"): in overlay-only the Scene
// draws the background layer's shade, and nothing else of it, so text over a clip keeps it.
import './fake-fonts'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Scene } from '@/shared/scene/scene'
import type { SceneProps } from '@/shared/scene/types'
import type { Shade } from '@/shared/schemas/layer'
import { asset, layer, variant } from './fixtures'

const shade: Shade = { color: '#000000', from: 'bottom', strength: 0.8, reach: 0.6 }
const video = { ...variant, format: 'video' as const, durationMs: 2000 }

function backgroundWith(style: Record<string, unknown>, over = {}) {
  return layer({
    id: 'bg',
    type: 'background',
    z: 0,
    source: { assetId: 'A1' },
    style: { opacity: 1, ...style },
    ...over,
  })
}

function draw(over: Partial<SceneProps>) {
  const props: SceneProps = {
    variant: video,
    layers: [],
    assets: { A1: asset() },
    timeMs: 500,
    mode: 'overlay-only',
    ...over,
  }
  const { container } = render(<Scene {...props} />)
  return container.firstElementChild as HTMLElement
}

const shadeOf = (root: HTMLElement) => root.querySelector<HTMLElement>('[data-shade-of="bg"]')

describe('the background shade in overlay-only [A-202, P8-17]', () => {
  it('draws the shade alone in the background box: no picture, no colour, no clip', () => {
    const bg = backgroundWith({ shade, fillColor: '#2850DC', opacity: 0.5 })
    const clips = [
      { id: 'c1', assetId: 'A1', startMs: 0, inMs: 0, outMs: 2000, placement: null, soundOn: true },
    ]
    const root = draw({ layers: [bg, layer({ id: 't', type: 'text' })], clips })
    const box = shadeOf(root)
    expect(box).not.toBeNull()
    expect(box?.style.left).toBe('10px')
    expect(box?.style.width).toBe('300px')
    expect(box?.style.opacity).toBe('0.5')
    expect(box?.style.backgroundColor).toBe('')
    expect(box?.querySelector('div')?.style.backgroundImage).toContain('linear-gradient(to top')
    expect(root.querySelector('img, video')).toBeNull()
    expect(root.style.backgroundColor).toBe('transparent')
  })

  it('sits under the other layers, by z', () => {
    const root = draw({
      layers: [layer({ id: 't', type: 'text', z: 3 }), backgroundWith({ shade })],
    })
    expect(root.firstElementChild?.getAttribute('data-shade-of')).toBe('bg')
  })

  it.each([
    ['no shade', backgroundWith({})],
    ['a shade it cannot use', backgroundWith({ shade: { ...shade, from: 'nowhere' } })],
  ])('draws nothing for the background with %s', (_, bg) => {
    const root = draw({ layers: [bg] })
    expect(root.children).toHaveLength(0)
  })

  it('is hidden like the layer when the layer is hidden or outside its time', () => {
    const hidden = draw({ layers: [backgroundWith({ shade }, { visible: false })] })
    expect(shadeOf(hidden)?.style.visibility).toBe('hidden')
    const later = draw({
      layers: [backgroundWith({ shade }, { timing: { startMs: 1000, endMs: null } })],
    })
    expect(shadeOf(later)?.style.visibility).toBe('hidden')
  })

  it('is drawn the same in an image variant in overlay-only', () => {
    expect(
      shadeOf(draw({ variant, timeMs: 0, layers: [backgroundWith({ shade })] })),
    ).not.toBeNull()
  })
})
