// P7-18 (spec/phases/phase-07-slices-2.md): a video variant's editor has the timeline along the
// foot and the canvas draws the Scene at the playhead's time; an image variant has no timeline.
import '../../shared/scene/fake-fonts'
import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Editor } from '@/renderer/editor/editor'
import type { VariantGet } from '@/shared/schemas/queries/variant'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { BACKGROUND, HEADLINE, LOGO, P, V, variantGet } from './editor-fixture'

// The headline shows from 2 s to 6 s of an 8 s video.
const LATE_HEADLINE = { ...HEADLINE, timing: { startMs: 2000, endMs: 6000 } }

function videoGet(): VariantGet {
  const base = variantGet({ layers: [BACKGROUND, LATE_HEADLINE, LOGO] })
  return { ...base, variant: { ...base.variant, format: 'video', durationMs: 8000 } }
}

async function open(reply: VariantGet) {
  const fake = makeFakeApi()
  fake.onQuery('variant.get', () => ({ ok: true, data: reply }))
  fake.onQuery('history.state', () => ({ ok: true, data: { canUndo: false, canRedo: false } }))
  await renderApp(<Editor projectId={P} variantId={V} />, fake)
  return screen.findByRole('region', { name: 'Canvas, Master post' })
}

// The headline's box in the drawn Scene: hidden outside its time.
function headlineHidden(canvas: HTMLElement): boolean {
  const text = within(canvas.querySelector('[data-stage]') as HTMLElement).getByText(
    LATE_HEADLINE.copy!,
  )
  return getComputedStyle(text.closest('[style*="position: absolute"]')!).visibility === 'hidden'
}

describe('Editor timeline [P7-18]', () => {
  it('an image variant has no timeline', async () => {
    await open(variantGet())
    expect(screen.queryByRole('region', { name: 'Timeline' })).toBeNull()
  })

  it('a video variant has the timeline with its rows, at 0', async () => {
    await open(videoGet())
    const timeline = screen.getByRole('region', { name: 'Timeline' })
    expect(within(timeline).getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(within(timeline).getByText('0:00.0 / 0:08.0')).toBeInTheDocument()
    const rows = within(timeline).getByRole('list', { name: 'Layer tracks' })
    expect(
      within(rows)
        .getAllByRole('listitem')
        .map((r) => r.textContent),
    ).toEqual(['Logo', 'Headline'])
    expect(await axeViolations()).toEqual([])
  })

  it('the canvas draws the Scene at the playhead time', async () => {
    const canvas = await open(videoGet())
    expect(headlineHidden(canvas)).toBe(true)
    const ruler = screen.getByRole('slider', { name: 'Time' })
    ruler.getBoundingClientRect = () => ({ left: 0, width: 800 }) as DOMRect
    fireEvent.pointerDown(ruler, { clientX: 300, button: 0 })
    fireEvent.pointerUp(window)
    expect(ruler).toHaveAttribute('aria-valuenow', '3000')
    expect(headlineHidden(canvas)).toBe(false)
  })
})

// Space as the keyboard sends it; fireEvent gives false when a handler prevented it.
function pressSpace(target: HTMLElement): boolean {
  act(() => target.focus())
  return fireEvent.keyDown(target, { code: 'Space', key: ' ' })
}

const playing = () =>
  within(screen.getByRole('region', { name: 'Timeline' })).queryByRole('button', {
    name: 'Pause',
  }) !== null

describe('Space plays or pauses [P7-18]', () => {
  it('on the canvas: plays, then pauses', async () => {
    const canvas = await open(videoGet())
    expect(pressSpace(canvas)).toBe(false)
    expect(playing()).toBe(true)
    expect(pressSpace(canvas)).toBe(false)
    expect(playing()).toBe(false)
  })

  it('on the timeline ruler: plays', async () => {
    await open(videoGet())
    expect(pressSpace(screen.getByRole('slider', { name: 'Time' }))).toBe(false)
    expect(playing()).toBe(true)
  })

  it('in a text field: does nothing and is not prevented', async () => {
    await open(videoGet())
    await userEvent.click(screen.getByRole('button', { name: 'Rename' }))
    expect(pressSpace(screen.getByRole('textbox', { name: 'Variant title' }))).toBe(true)
    expect(playing()).toBe(false)
  })

  it('on a button elsewhere in the editor: does nothing and is not prevented', async () => {
    await open(videoGet())
    expect(pressSpace(screen.getByRole('button', { name: 'Rename' }))).toBe(true)
    expect(playing()).toBe(false)
  })
})
