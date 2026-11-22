// P7-8, phase-07.md "Clips and the track", "Drawing": a video variant draws the clip under the
// time in place of the background layer's own source, with the layer's opacity, fill colour
// and shade; no clip is black. An image variant draws its background as before.
import './fake-fonts'
import { describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { Scene } from '@/shared/scene/scene'
import type { SceneClip, SceneProps } from '@/shared/scene/types'
import { asset, layer, variant } from './fixtures'

const video = { ...variant, format: 'video' as const, durationMs: 4000 }
const background = layer({
  id: 'bg',
  type: 'background',
  z: 0,
  style: {
    opacity: 0.5,
    fillColor: '#102030',
    shade: { color: '#000000', from: 'all', strength: 0.5, reach: 0.5 },
  },
  geometry: { x: 0, y: 0, width: 1080, height: 1350, rotation: 0, crop: null },
  source: { assetId: 'own' },
})
const ASSETS = {
  own: asset({ url: 'adman-asset://p1/own' }),
  still: asset({ url: 'adman-asset://p1/still' }),
  film: asset({ url: 'adman-asset://p1/film', kind: 'video', width: 64, height: 64 }),
  font: asset({ url: 'adman-asset://p1/font', kind: 'font' }),
  gone: asset({ url: 'adman-asset://p1/gone', missing: true }),
}
const clip = (id: string, assetId: string, over: Partial<SceneClip> = {}): SceneClip => ({
  id,
  assetId,
  startMs: 0,
  inMs: 0,
  outMs: 1000,
  placement: null,
  soundOn: true,
  ...over,
})

function draw(over: Partial<SceneProps>) {
  const props: SceneProps = {
    variant: video,
    layers: [background],
    assets: ASSETS,
    timeMs: 0,
    mode: 'full',
  }
  const { container } = render(<Scene {...props} {...over} />)
  const root = container.firstElementChild as HTMLElement
  const box = root.querySelector('[data-layer-id="bg"]') as HTMLElement | null
  return { root, box }
}

const sources = (el: Element | null) =>
  [...(el?.querySelectorAll('img, video') ?? [])].map((m) => m.getAttribute('src'))

describe('the background track [P7-8]', () => {
  it('draws a still clip in place of the background layer source, with its look', () => {
    const { box } = draw({ clips: [clip('c1', 'still')], timeMs: 500 })
    expect(sources(box)).toEqual(['adman-asset://p1/still'])
    expect(box?.style.opacity).toBe('0.5')
    expect(box?.style.backgroundColor).toBe('rgb(16, 32, 48)')
    expect(box?.querySelectorAll('div').length).toBeGreaterThan(1)
  })

  it('draws a gap as nothing over the black root', () => {
    const { root, box } = draw({ clips: [clip('c1', 'still', { startMs: 2000 })], timeMs: 500 })
    expect(root.style.backgroundColor).toBe('rgb(0, 0, 0)')
    expect(sources(box)).toEqual([])
    expect(box?.style.backgroundColor).toBe('')
    expect(box?.children.length).toBe(0)
  })

  it.each([
    ['no clips at all', undefined],
    ['a clip whose asset is missing', [clip('c1', 'gone')]],
    ['a clip whose asset is a font', [clip('c1', 'font')]],
    ['a clip whose asset is not in the assets', [clip('c1', 'unknown')]],
  ])('draws black for %s', (_name, clips) => {
    const { box } = draw({ clips, timeMs: 500 })
    expect(sources(box)).toEqual([])
  })

  it('draws a clip that runs past the variant end only up to the end', () => {
    const clips = [clip('c1', 'still', { startMs: 3500 })]
    expect(sources(draw({ clips, timeMs: 3999 }).box)).toEqual(['adman-asset://p1/still'])
    expect(sources(draw({ clips, timeMs: 4000 }).box)).toEqual([])
  })

  it('draws a video clip muted, inline and preloaded', () => {
    const { box } = draw({ clips: [clip('c1', 'film')], timeMs: 200 })
    const el = box?.querySelector('video') as HTMLVideoElement
    expect(el.getAttribute('src')).toBe('adman-asset://p1/film')
    expect(el.muted).toBe(true)
    expect(el.playsInline).toBe(true)
    expect(el.getAttribute('preload')).toBe('auto')
  })

  it.each([
    ['sound on and the clip sound on', true, true, false],
    ['sound off', false, true, true],
    ['the clip sound off', true, false, true],
  ])('mutes a video clip by its sound: %s', (_name, sound, soundOn, muted) => {
    const { box } = draw({ clips: [clip('c1', 'film', { soundOn })], sound, timeMs: 200 })
    expect((box?.querySelector('video') as HTMLVideoElement).muted).toBe(muted)
  })

  it('places a clip in its own placement box inside the layer', () => {
    const placement = { x: 100, y: 50, width: 400, height: 300, rotation: 10, crop: null }
    const { box } = draw({ clips: [clip('c1', 'still', { placement })], timeMs: 0 })
    const frame = box?.querySelector('img')?.parentElement as HTMLElement
    expect(frame.style).toMatchObject({ left: '100px', top: '50px', width: '400px' })
    expect(frame.style.transform).toBe('rotate(10deg)')
  })

  it('keeps an image variant drawing its own background source, clips or not', () => {
    const { box } = draw({ variant, clips: [clip('c1', 'still')], timeMs: 500 })
    expect(sources(box)).toEqual(['adman-asset://p1/own'])
  })

  it('leaves the track out in overlay-only mode', () => {
    const { box } = draw({ clips: [clip('c1', 'still')], mode: 'overlay-only' })
    expect(box).toBeNull()
  })

  it('settles over a still clip, as for a picture', async () => {
    const onSettled = vi.fn()
    draw({ clips: [clip('c1', 'still')], onSettled })
    await waitFor(() => expect(onSettled).toHaveBeenCalledWith({ overflow: {} }))
  })
})
