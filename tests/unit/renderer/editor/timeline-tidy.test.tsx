// ED-6 (spec/phases/design-wave-screens-a.md, "Timeline small flaws"): the timeline is compact;
// Play is an icon button; a clip is named by its file alone and its actions sit in a small bar
// over its block; the sound options read "Clip sound", "Audio file", "None"; Animation is a
// folded Section with "In" and "Out" rows. Every command sent is the same as before.
import '../../shared/scene/fake-fonts'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ClipTrack } from '@/renderer/editor/clip-track'
import { PropertiesPanel } from '@/renderer/editor/properties-panel'
import { SoundFields, SoundScope } from '@/renderer/editor/sound-fields'
import { Timeline } from '@/renderer/editor/timeline'
import { TransportBar } from '@/renderer/editor/transport-bar'
import { createPlaybackStore } from '@/renderer/stores/playback-store'
import { createVariantStore } from '@/renderer/stores/variant-store'
import type { BackgroundClipRow } from '@/shared/schemas/rows/background-clip'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { BACKGROUND, HEADLINE, LOGO, P, V, assetRow, variantGet } from './editor-fixture'
import { variant } from '../screens/campaign/campaign-fixture'

const VIDEO_POST = variant(V, { format: 'video', durationMs: 8000 })
const WAVE = assetRow('A7', { kind: 'video', mime: 'video/mp4', displayName: 'wave.mp4' })
const BEACH = assetRow('A1', { displayName: 'beach.png' })

const clip = (id: string, over: Partial<BackgroundClipRow>): BackgroundClipRow => ({
  id,
  variantId: V,
  assetId: 'A1',
  startMs: 0,
  inMs: 0,
  outMs: 2000,
  placement: null,
  soundOn: true,
  ...over,
})

const CLIPS = [
  clip('K1', { assetId: 'A7' }),
  clip('K2', { assetId: 'A1', startMs: 4000 }),
  clip('K3', { assetId: 'GONE', startMs: 6000 }),
]

async function clipTrack() {
  const fake = makeFakeApi()
  fake.onQuery('variant.get', () => ({
    ok: true,
    data: variantGet({ variant: VIDEO_POST, clips: CLIPS, assets: [BEACH, WAVE] }),
  }))
  const store = createVariantStore(fake.api, P, V)
  await store.getState().load()
  await renderApp(
    <main>
      <ClipTrack projectId={P} variant={VIDEO_POST} store={store} />
    </main>,
    fake,
  )
  return (name: string) => fake.commands.filter((c) => c.name === name).map((c) => c.input)
}

const block = (name: string) => screen.getByRole('button', { name, pressed: false })

describe('ED-6: the transport bar', () => {
  it('Play and Pause are icon buttons with those names and no visible word', async () => {
    const onToggle = vi.fn()
    const props = { projectId: P, variant: VIDEO_POST, timeMs: 0, onToggle }
    const { rerender } = render(
      <main>
        <TransportBar {...props} playing={false} />
      </main>,
    )
    const play = screen.getByRole('button', { name: 'Play' })
    expect(play).toHaveAttribute('title', 'Play')
    expect(play.textContent).toBe('')
    await userEvent.click(play)
    expect(onToggle).toHaveBeenCalledOnce()
    rerender(
      <main>
        <TransportBar {...props} playing />
      </main>,
    )
    const pause = screen.getByRole('button', { name: 'Pause' })
    expect(pause).toHaveAttribute('title', 'Pause')
    expect(pause.textContent).toBe('')
    expect(await axeViolations()).toEqual([])
  })

  it('reads the sound options "Clip sound", "Audio file", "None"', async () => {
    const fake = makeFakeApi()
    render(
      <SoundScope.Provider value={fake.api}>
        <SoundFields projectId={P} variant={VIDEO_POST} />
      </SoundScope.Provider>,
    )
    const choice = screen.getByRole('combobox', { name: 'Sound' }) as HTMLSelectElement
    expect([...choice.options].map((o) => [o.value, o.text])).toEqual([
      ['clips', 'Clip sound'],
      ['file', 'Audio file'],
      ['none', 'None'],
    ])
  })
})

describe('ED-6: the clips', () => {
  it('names each clip by its file alone, "File not found" when missing, no "Clip n:"', async () => {
    await clipTrack()
    const lane = screen.getByRole('list', { name: 'Clips' })
    expect(
      within(lane)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['wave.mp4', 'beach.png', 'File not found'])
    expect(lane.innerHTML).not.toMatch(/Clip \d/)
    expect(screen.getByRole('slider', { name: 'Start of wave.mp4' })).toBeInTheDocument()
  })

  it("shows the chosen clip's bar over its block without changing the block's size", async () => {
    const sent = await clipTrack()
    const user = userEvent.setup()
    const box = block('wave.mp4').closest<HTMLElement>('[data-clip]')!
    const before = { left: box.style.left, width: box.style.width }
    expect(screen.queryByRole('group', { name: 'wave.mp4' })).toBeNull()
    await user.click(block('wave.mp4'))
    const bar = screen.getByRole('group', { name: 'wave.mp4' })
    expect(box.contains(bar)).toBe(false)
    expect({ left: box.style.left, width: box.style.width }).toEqual(before)
    expect(within(bar).queryByRole('checkbox')).toBeNull()
    const sound = within(bar).getByRole('button', { name: 'Sound for wave.mp4' })
    expect(sound).toHaveAttribute('aria-pressed', 'true')
    expect(sound).toHaveAttribute('title', 'Sound for wave.mp4')
    await user.click(sound)
    await user.click(within(bar).getByRole('button', { name: 'Remove wave.mp4' }))
    expect(sent('clip.update')).toEqual([{ projectId: P, clipId: 'K1', soundOn: false }])
    expect(sent('clip.remove')).toEqual([{ projectId: P, clipId: 'K1' }])
    expect(await axeViolations()).toEqual([])
  })

  it('a still has no sound button; a missing file is named "File not found"', async () => {
    const sent = await clipTrack()
    const user = userEvent.setup()
    await user.click(block('beach.png'))
    const bar = screen.getByRole('group', { name: 'beach.png' })
    expect(within(bar).queryByRole('button', { name: /^Sound for/ })).toBeNull()
    await user.click(block('File not found'))
    await user.click(screen.getByRole('button', { name: 'Remove File not found' }))
    expect(sent('clip.remove')).toEqual([{ projectId: P, clipId: 'K3' }])
  })
})

const TITLE: LayerRow = {
  ...HEADLINE,
  timing: { startMs: 1000, endMs: 5000 },
  animation: {
    entrance: { preset: 'fade-up', startMs: 1000, durationMs: 500 },
    exit: { preset: 'fade', startMs: 4000, durationMs: 1000 },
  },
}

async function properties(layer: LayerRow) {
  const fake = makeFakeApi()
  await renderApp(
    <main>
      <PropertiesPanel
        projectId={P}
        campaignId="C1"
        layer={layer}
        layers={[BACKGROUND, layer, LOGO]}
        canvas={VIDEO_POST}
      />
    </main>,
    fake,
  )
  return () =>
    fake.commands
      .filter((c) => c.name === 'layer.update')
      .map((c) => (c.input as { patch: unknown }).patch)
}

const animationButton = () => screen.getByRole('button', { name: 'Animation' })

describe('ED-6: Animation', () => {
  it('starts folded with the two preset names as its summary', async () => {
    await properties(TITLE)
    expect(animationButton()).toHaveAttribute('aria-expanded', 'false')
    const section = screen.getByRole('region', { name: 'Animation' })
    expect(section).toHaveTextContent('Fade up · Fade')
    expect(screen.getByRole('heading', { name: 'Animation', level: 4 })).toBeInTheDocument()
  })

  it('reads "None" for a block with no preset', async () => {
    const none = { preset: 'none' as const, startMs: 0, durationMs: 0 }
    await properties({ ...TITLE, animation: { entrance: none, exit: TITLE.animation.exit } })
    expect(screen.getByRole('region', { name: 'Animation' })).toHaveTextContent('None · Fade')
  })

  it('has "In" and "Out" rows whose fields keep their names and send what they sent', async () => {
    const patches = await properties(TITLE)
    const user = userEvent.setup()
    if (animationButton().getAttribute('aria-expanded') === 'false') {
      await user.click(animationButton())
    }
    const section = screen.getByRole('region', { name: 'Animation' })
    expect(within(section).getByText('In')).toBeVisible()
    expect(within(section).getByText('Out')).toBeVisible()
    expect(within(section).queryByText('Entrance')).toBeNull()
    expect(within(section).queryByText('Exit')).toBeNull()
    expect(within(section).queryByText('Length')).toBeNull()
    expect(within(section).getAllByText('s')).toHaveLength(2)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Exit' }), 'Slide')
    const exitLength = screen.getByRole('spinbutton', { name: 'Exit length' })
    await user.clear(exitLength)
    await user.type(exitLength, '0.4{Enter}')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Entrance' }), 'None')
    expect(screen.getByRole('spinbutton', { name: 'Entrance length' })).toBeInTheDocument()
    expect(patches()).toEqual([
      { animation: { exit: { preset: 'slide', startMs: 4000, durationMs: 1000 } } },
      { animation: { exit: { preset: 'fade', startMs: 4600, durationMs: 400 } } },
      { animation: { entrance: { preset: 'none', startMs: 1000, durationMs: 500 } } },
    ])
    expect(await axeViolations()).toEqual([])
  })
})

describe('ED-6: the timeline root', () => {
  it('carries compact density', () => {
    const playback = createPlaybackStore(8000)
    const store = createVariantStore(makeFakeApi().api, P, V)
    render(
      <Timeline projectId={P} variant={VIDEO_POST} layers={[]} store={store} playback={playback} />,
    )
    const timeline = screen.getByRole('region', { name: 'Timeline' })
    expect(timeline).toHaveAttribute('data-density', 'compact')
  })
})
