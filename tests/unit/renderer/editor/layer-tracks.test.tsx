// spec/phases/phase-07-slices-2.md, P7-19: each layer's row shows its timing bar, named "Timing
// of {layer}", and a text layer's row its entrance and exit blocks ("Entrance of {layer}",
// "Exit of {layer}"). The arrows move a bar or block 100 ms (1 s with Shift) and its ends
// resize it; a drag snaps to 100 ms and to the playhead and sends one layer.update when it
// ends. A move carries the blocks along; a resize pulls them inside. A key on a bar acts on it
// only. A refusal shows its sentence under the rows.
import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { LayerTracks } from '@/renderer/editor/layer-tracks'
import { createPlaybackStore } from '@/renderer/stores/playback-store'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { BACKGROUND, HEADLINE, LOGO, P } from './editor-fixture'
import { variant } from '../screens/campaign/campaign-fixture'

const VIDEO = { ...variant('V1'), format: 'video' as const, durationMs: 8000 }
const TITLE = {
  ...HEADLINE,
  timing: { startMs: 1000, endMs: 5000 },
  animation: {
    entrance: { preset: 'fade' as const, startMs: 1000, durationMs: 500 },
    exit: { preset: 'fade-up' as const, startMs: 4500, durationMs: 500 },
  },
}

async function setup() {
  const fake = makeFakeApi()
  const playback = createPlaybackStore(8000)
  await renderApp(
    <main>
      <LayerTracks
        projectId={P}
        variant={VIDEO}
        layers={[BACKGROUND, TITLE, LOGO]}
        playback={playback}
      />
    </main>,
    fake,
  )
  for (const lane of document.querySelectorAll<HTMLElement>('[data-layer-lane]')) {
    lane.getBoundingClientRect = () => ({ left: 0, width: 800 }) as DOMRect
  }
  const sent = () => fake.commands.filter((c) => c.name === 'layer.update').map((c) => c.input)
  return { fake, playback, sent }
}

const body = (name: string) => screen.getByRole('button', { name })
const end = (name: string) => screen.getByRole('slider', { name: `End of ${name}` })
const box = (name: string) => body(name).parentElement!

describe('LayerTracks: bars and blocks [P7-19]', () => {
  it("draws each bar and a text layer's blocks by time, a null end to the variant's end", async () => {
    await setup()
    expect(box('Timing of Headline').style).toMatchObject({ left: '12.5%', width: '50%' })
    expect(box('Timing of Logo').style).toMatchObject({ left: '0%', width: '100%' })
    expect(box('Entrance of Headline').style).toMatchObject({ left: '12.5%', width: '6.25%' })
    expect(box('Exit of Headline')).toHaveAttribute('title', 'Fade up')
    expect(screen.queryByRole('button', { name: 'Entrance of Logo' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Timing of Background' })).toBeNull()
    expect(end('Timing of Logo')).toHaveAttribute('aria-valuenow', '8000')
    expect(await axeViolations()).toEqual([])
  })

  it('the arrows move a bar with its blocks, and resize its end, one layer.update each', async () => {
    const { sent } = await setup()
    const user = userEvent.setup()
    body('Timing of Headline').focus()
    await user.keyboard('{ArrowRight}')
    end('Timing of Headline').focus()
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}')
    end('Timing of Logo').focus()
    await user.keyboard('{ArrowLeft}')
    expect(sent()).toEqual([
      {
        projectId: P,
        layerId: 'L1',
        patch: {
          timing: { startMs: 1100, endMs: 5100 },
          animation: {
            entrance: { preset: 'fade', startMs: 1100, durationMs: 500 },
            exit: { preset: 'fade-up', startMs: 4600, durationMs: 500 },
          },
        },
      },
      {
        projectId: P,
        layerId: 'L1',
        patch: {
          timing: { startMs: 1000, endMs: 4000 },
          animation: { exit: { preset: 'fade-up', startMs: 3500, durationMs: 500 } },
        },
      },
      { projectId: P, layerId: 'L2', patch: { timing: { startMs: 0, endMs: 7900 } } },
    ])
  })

  it('the arrows move a block inside its bar and send that block only', async () => {
    const { sent } = await setup()
    const user = userEvent.setup()
    body('Entrance of Headline').focus()
    await user.keyboard('{ArrowRight}')
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}')
    screen.getByRole('slider', { name: 'End of Exit of Headline' }).focus()
    await user.keyboard('{ArrowLeft}')
    expect(sent().map((c) => (c as { patch: unknown }).patch)).toEqual([
      { animation: { entrance: { preset: 'fade', startMs: 1100, durationMs: 500 } } },
      { animation: { exit: { preset: 'fade-up', startMs: 4500, durationMs: 400 } } },
    ])
  })

  it('a key on a bar acts on that bar only', async () => {
    const { sent } = await setup()
    for (const key of ['Delete', 'Backspace', 'ArrowUp', 'ArrowDown']) {
      expect(fireEvent.keyDown(body('Timing of Headline'), { key })).toBe(false)
    }
    expect(sent()).toEqual([])
  })

  it('a drag snaps to 100 ms, or to the playhead when near it, and sends once at the end', async () => {
    const { sent, playback } = await setup()
    fireEvent.pointerDown(end('Timing of Logo'), { clientX: 800, button: 0 })
    fireEvent.pointerMove(window, { clientX: 700 })
    expect(end('Timing of Logo')).toHaveAttribute('aria-valuenow', '7000')
    fireEvent.pointerUp(window, { clientX: 643 })
    act(() => playback.getState().scrub(3000))
    fireEvent.pointerDown(body('Timing of Headline'), { clientX: 200, button: 0 })
    fireEvent.pointerUp(window, { clientX: 397 })
    expect(sent().map((c) => (c as { patch: unknown }).patch)).toEqual([
      { timing: { startMs: 0, endMs: 6400 } },
      {
        timing: { startMs: 3000, endMs: 7000 },
        animation: {
          entrance: { preset: 'fade', startMs: 3000, durationMs: 500 },
          exit: { preset: 'fade-up', startMs: 6500, durationMs: 500 },
        },
      },
    ])
  })

  it('shows a refusal sentence under the rows', async () => {
    const { fake } = await setup()
    const message = 'That layer was not found.'
    fake.onCommand('layer.update', () => ({
      ok: false,
      error: { code: 'NOT_FOUND', message },
    }))
    end('Timing of Logo').focus()
    await userEvent.setup().keyboard('{ArrowLeft}')
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })
})
