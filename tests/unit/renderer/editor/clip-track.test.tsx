// spec/phases/phase-07-slices-2.md, P7-20: the background row shows the clips as blocks named
// "Clip {n}: {display name}" at their place on the track, gaps left as empty track. A block
// moves with the arrows (100 ms, Shift 1 s) and by a drag, its ends trim, Delete or "Remove"
// takes it off, and a video clip has "Sound". A drag that would overlap snaps back without a
// command; one past another clip reorders. A refusal shows its sentence under the row.
import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ClipTrack } from '@/renderer/editor/clip-track'
import { createVariantStore } from '@/renderer/stores/variant-store'
import type { BackgroundClipRow } from '@/shared/schemas/rows/background-clip'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { P, V, assetRow, variantGet } from './editor-fixture'
import { variant } from '../screens/campaign/campaign-fixture'

const VIDEO_POST = variant(V, { format: 'video', durationMs: 8000 })
const WAVE = assetRow('A7', {
  kind: 'video',
  mime: 'video/mp4',
  displayName: 'wave.mp4',
  durationMs: 3000,
})
const BEACH = assetRow('A1', { displayName: 'beach.png' })

const clip = (id: string, over: Partial<BackgroundClipRow>): BackgroundClipRow => ({
  id,
  variantId: V,
  assetId: 'A1',
  startMs: 0,
  inMs: 0,
  outMs: 1000,
  placement: null,
  soundOn: true,
  ...over,
})

// A video from 0 to 2 s (file 3 s long, in at 0, out at 2 s), a gap, a still from 4 s to 6 s.
const CLIPS = [
  clip('K1', { assetId: 'A7', startMs: 0, inMs: 0, outMs: 2000 }),
  clip('K2', { assetId: 'A1', startMs: 4000, inMs: 0, outMs: 2000 }),
]

async function setup(clips = CLIPS) {
  const fake = makeFakeApi()
  fake.onQuery('variant.get', () => ({
    ok: true,
    data: variantGet({ variant: VIDEO_POST, clips, assets: [BEACH, WAVE] }),
  }))
  const store = createVariantStore(fake.api, P, V)
  await store.getState().load()
  const view = await renderApp(
    <main>
      <ClipTrack projectId={P} variant={VIDEO_POST} store={store} />
    </main>,
    fake,
  )
  const lane = document.querySelector<HTMLElement>('[data-clip-lane]')!
  lane.getBoundingClientRect = () => ({ left: 0, width: 800 }) as DOMRect
  const sent = (name: string) => fake.commands.filter((c) => c.name === name).map((c) => c.input)
  return { ...view, fake, store, sent }
}

const block = (name: string) => screen.getByRole('button', { name })
const blockBox = (name: string) => block(name).closest<HTMLElement>('[data-clip]')!

describe('ClipTrack: the clips as blocks [P7-20]', () => {
  it('names each block "Clip {n}: {display name}" in track order and places it by time', async () => {
    await setup()
    expect(blockBox('Clip 1: wave.mp4').style.left).toBe('0%')
    expect(blockBox('Clip 1: wave.mp4').style.width).toBe('25%')
    expect(blockBox('Clip 2: beach.png').style.left).toBe('50%')
    expect(screen.getByText('Background')).toBeInTheDocument()
    expect(await axeViolations()).toEqual([])
  })

  it('moves a block 100 ms with an arrow and 1 s with Shift', async () => {
    const { sent } = await setup()
    const user = userEvent.setup()
    block('Clip 2: beach.png').focus()
    await user.keyboard('{ArrowRight}')
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}')
    expect(sent('clip.update')).toEqual([
      { projectId: P, clipId: 'K2', startMs: 4100 },
      { projectId: P, clipId: 'K2', startMs: 3000 },
    ])
  })

  it('sends nothing for an arrow that would overlap the next clip', async () => {
    const { fake } = await setup([CLIPS[0]!, { ...CLIPS[1]!, startMs: 2000 }])
    const user = userEvent.setup()
    block('Clip 2: beach.png').focus()
    await user.keyboard('{ArrowLeft}')
    expect(fake.commands).toEqual([])
  })

  it('trims either end with the arrows', async () => {
    const { sent } = await setup()
    const user = userEvent.setup()
    screen.getByRole('slider', { name: 'End of Clip 1: wave.mp4' }).focus()
    await user.keyboard('{ArrowLeft}')
    screen.getByRole('slider', { name: 'Start of Clip 1: wave.mp4' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(sent('clip.update')).toEqual([
      { projectId: P, clipId: 'K1', outMs: 1900 },
      { projectId: P, clipId: 'K1', startMs: 100, inMs: 100 },
    ])
  })

  it('stops an end trim at the end of the video file', async () => {
    const { sent } = await setup([{ ...CLIPS[0]!, outMs: 2500 }, CLIPS[1]!])
    const user = userEvent.setup()
    screen.getByRole('slider', { name: 'End of Clip 1: wave.mp4' }).focus()
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
    expect(sent('clip.update')).toEqual([{ projectId: P, clipId: 'K1', outMs: 3000 }])
  })

  it('moves a block by a drag in 100 ms steps, and snaps an overlapping drag back', async () => {
    const { sent } = await setup()
    const body = block('Clip 2: beach.png')
    fireEvent.pointerDown(body, { clientX: 500, button: 0 })
    fireEvent.pointerMove(window, { clientX: 552 })
    expect(blockBox('Clip 2: beach.png').style.left).toBe('56.25%')
    fireEvent.pointerUp(window, { clientX: 552 })
    expect(sent('clip.update')).toEqual([{ projectId: P, clipId: 'K2', startMs: 4500 }])

    fireEvent.pointerDown(body, { clientX: 500, button: 0 })
    fireEvent.pointerUp(window, { clientX: 290 })
    expect(sent('clip.update')).toHaveLength(1)
    expect(blockBox('Clip 2: beach.png').style.left).toBe('50%')
  })

  it('reorders the track when a block is dragged past the middle of another', async () => {
    const { sent } = await setup()
    fireEvent.pointerDown(block('Clip 1: wave.mp4'), { clientX: 100, button: 0 })
    fireEvent.pointerUp(window, { clientX: 520 })
    expect(sent('clip.reorder')).toEqual([{ projectId: P, variantId: V, clipIds: ['K2', 'K1'] }])
  })

  it('removes a clip with Delete and with "Remove", and switches a video clip\'s sound', async () => {
    const { sent } = await setup()
    const user = userEvent.setup()
    block('Clip 2: beach.png').focus()
    expect(screen.queryByRole('checkbox', { name: 'Sound' })).toBeNull()
    await user.keyboard('{Delete}')
    await user.click(block('Clip 1: wave.mp4'))
    const actions = screen.getByRole('group', { name: 'Clip 1: wave.mp4' })
    await user.click(within(actions).getByRole('checkbox', { name: 'Sound' }))
    await user.click(within(actions).getByRole('button', { name: 'Remove' }))
    expect(sent('clip.remove')).toEqual([
      { projectId: P, clipId: 'K2' },
      { projectId: P, clipId: 'K1' },
    ])
    expect(sent('clip.update')).toEqual([{ projectId: P, clipId: 'K1', soundOn: false }])
  })

  it('shows a refusal sentence under the row, and clears it after the next change', async () => {
    const { fake } = await setup()
    const user = userEvent.setup()
    const message = "That trim reaches past the end of the clip's file."
    fake.onCommand('clip.update', () => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message, details: { reason: 'clip_trim_out_of_range' } },
    }))
    block('Clip 2: beach.png').focus()
    await user.keyboard('{ArrowRight}')
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    fake.onCommand('clip.update', () => ({ ok: true, data: { clipId: 'K2' } }))
    await user.keyboard('{ArrowRight}')
    await act(async () => {})
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
