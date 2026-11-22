// P7-18 (spec/phases/phase-07-slices-2.md): a video variant's timeline: the transport bar, the
// ruler, one row per layer (its name only), a background row and the playhead. The stub
// folders (layer-tracks, clip-track, sound-fields) are filled by P7-19 to P7-21.
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Timeline } from '@/renderer/editor/timeline'
import { Playhead } from '@/renderer/editor/playhead'
import { LayerTracks } from '@/renderer/editor/layer-tracks'
import { ClipTrack } from '@/renderer/editor/clip-track'
import { SoundFields } from '@/renderer/editor/sound-fields'
import { createPlaybackStore, type Clock } from '@/renderer/stores/playback-store'
import { createVariantStore } from '@/renderer/stores/variant-store'
import { BACKGROUND, HEADLINE, LOGO } from './editor-fixture'
import { variant } from '../screens/campaign/campaign-fixture'
import { makeFakeApi } from '../fake-api'
import { axeViolations } from '../render'

const VIDEO = { ...variant('V1'), format: 'video' as const, durationMs: 8000 }
const LAYERS = [BACKGROUND, HEADLINE, LOGO]

// A clock whose frames run only when step() is called.
function standInClock() {
  let now = 0
  let queued: (() => void)[] = []
  const clock: Clock = {
    now: () => now,
    frame: (callback) => queued.push(callback),
    cancel: () => {
      queued = []
    },
  }
  const step = (ms: number) =>
    act(() => {
      now += ms
      const due = queued
      queued = []
      due.forEach((callback) => callback())
    })
  return { clock, step }
}

function setUp() {
  const { clock, step } = standInClock()
  const playback = createPlaybackStore(8000, clock)
  const store = createVariantStore(makeFakeApi().api, 'P1', 'V1')
  render(
    <Timeline projectId="P1" variant={VIDEO} layers={LAYERS} store={store} playback={playback} />,
  )
  return { playback, step, region: screen.getByRole('region', { name: 'Timeline' }) }
}

const playheadLeft = (region: HTMLElement) =>
  (region.querySelector('[data-playhead]') as HTMLElement).style.left

describe('Timeline [P7-18]', () => {
  it('has the transport bar, the ruler, a row per layer and a background row', async () => {
    const { region } = setUp()
    expect(within(region).getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(within(region).getByRole('slider', { name: 'Time' })).toBeInTheDocument()
    const rows = within(region).getByRole('list', { name: 'Layer tracks' })
    expect(
      within(rows)
        .getAllByRole('listitem')
        .map((r) => r.textContent),
    ).toEqual(['Logo', 'Headline'])
    expect(within(region).getByText('Background')).toBeInTheDocument()
    expect(playheadLeft(region)).toBe('0%')
    expect(await axeViolations()).toEqual([])
  })

  it('Play moves the playhead and the time; Pause holds them', async () => {
    const { region, step, playback } = setUp()
    await userEvent.click(within(region).getByRole('button', { name: 'Play' }))
    step(2000)
    expect(playheadLeft(region)).toBe('25%')
    expect(within(region).getByText('0:02.0 / 0:08.0')).toBeInTheDocument()
    await userEvent.click(within(region).getByRole('button', { name: 'Pause' }))
    step(2000)
    expect(playback.getState()).toMatchObject({ timeMs: 2000, playing: false })
    expect(within(region).getByRole('button', { name: 'Play' })).toBeInTheDocument()
  })

  it('a press on the ruler scrubs the playback', () => {
    const { region, playback } = setUp()
    const ruler = within(region).getByRole('slider', { name: 'Time' })
    ruler.getBoundingClientRect = () => ({ left: 0, width: 400 }) as DOMRect
    act(() => {
      ruler.dispatchEvent(new MouseEvent('pointerdown', { clientX: 200, bubbles: true }))
    })
    expect(playback.getState().timeMs).toBe(4000)
    expect(playheadLeft(region)).toBe('50%')
  })
})

describe('Playhead [P7-18]', () => {
  it.each([
    [0, 8000, '0%'],
    [6000, 8000, '75%'],
    [8000, 8000, '100%'],
    [0, 0, '0%'],
  ])('at %i of %i stands at %s', (timeMs, durationMs, left) => {
    const { container } = render(<Playhead timeMs={timeMs} durationMs={durationMs} />)
    const line = container.querySelector('[data-playhead]') as HTMLElement
    expect(line.style.left).toBe(left)
    expect(line).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('the stub tracks [P7-18]', () => {
  it('LayerTracks: one row per layer but the background, the top layer first', () => {
    const playback = createPlaybackStore(8000)
    render(<LayerTracks projectId="P1" variant={VIDEO} layers={LAYERS} playback={playback} />)
    const rows = screen.getByRole('list', { name: 'Layer tracks' })
    expect(
      within(rows)
        .getAllByRole('listitem')
        .map((r) => r.textContent),
    ).toEqual(['Logo', 'Headline'])
  })

  it('ClipTrack: one row named Background', () => {
    const store = createVariantStore(makeFakeApi().api, 'P1', 'V1')
    const { container } = render(<ClipTrack projectId="P1" variant={VIDEO} store={store} />)
    expect(container).toHaveTextContent(/^Background$/)
  })

  it('SoundFields: renders nothing yet', () => {
    const { container } = render(<SoundFields projectId="P1" variant={VIDEO} />)
    expect(container).toBeEmptyDOMElement()
  })
})
