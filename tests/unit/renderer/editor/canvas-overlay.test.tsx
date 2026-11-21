// spec/editor.md, "Canvas", "Moving, resizing and rotating", "Snapping and guides" and
// "Keyboard shortcuts" (P3-11): one layer.update per drag, Escape cancels, a locked layer has
// no handles, Delete, Mod+D and the arrows, placeholders and overflow boxes.
import '../../shared/scene/fake-fonts'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Editor } from '@/renderer/editor/editor'
import type { VariantGet } from '@/shared/schemas/queries/variant'
import { makeFakeApi } from '../fake-api'
import { renderApp } from '../render'
import { BACKGROUND, HEADLINE, LOGO, P, V, variantGet } from './editor-fixture'

// jsdom has no layout: the canvas draws at 25% with its corner at the page's corner, so a
// variant point is a quarter of it in screen pixels.
const S = 0.25

async function open(reply: VariantGet = variantGet()) {
  const fake = makeFakeApi()
  fake.onQuery('variant.get', () => ({ ok: true, data: reply }))
  fake.onQuery('history.state', () => ({ ok: true, data: { canUndo: false, canRedo: false } }))
  const view = await renderApp(<Editor projectId={P} variantId={V} />, fake)
  const canvas = await screen.findByRole('region', { name: 'Canvas, Master post' })
  return { ...view, fake, canvas, stage: canvas.querySelector('[data-stage]') as HTMLElement }
}

const updates = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.commands.filter((c) => c.name === 'layer.update').map((c) => c.input)
const selection = (canvas: HTMLElement) =>
  canvas.querySelector('[data-selection]') as HTMLElement | null
const handle = (canvas: HTMLElement, name: string) =>
  canvas.querySelector(`[data-handle="${name}"]`) as HTMLElement

// A press at a variant point, then moves by screen offsets, then the release.
function drag(target: HTMLElement, from: { x: number; y: number }, moves: number[][], up = true) {
  const start = { clientX: from.x * S, clientY: from.y * S }
  fireEvent.pointerDown(target, { ...start, button: 0 })
  for (const [dx, dy, alt] of moves) {
    fireEvent.pointerMove(window, {
      clientX: start.clientX + dx!,
      clientY: start.clientY + dy!,
      altKey: alt === 1,
    })
  }
  if (up) fireEvent.pointerUp(window, start)
}

async function select(canvas: HTMLElement, stage: HTMLElement, x: number, y: number) {
  fireEvent.click(stage, { clientX: x * S, clientY: y * S })
  await waitFor(() => expect(selection(canvas)).not.toBeNull())
}

const geometryUpdate = (geometry: object, layerId = 'L1') => ({
  projectId: P,
  layerId,
  patch: { geometry },
})

describe('Canvas overlay: moving [FR-092]', () => {
  it('a press on a layer selects it; a drag sends one layer.update with only x and y', async () => {
    const { fake, canvas, stage } = await open()
    drag(
      stage,
      { x: 500, y: 200 },
      [
        [2, 1],
        [6, 3],
        [12, 6],
      ],
      false,
    )
    expect(selection(canvas)).toHaveStyle({
      left: `${(90 + 48) * S}px`,
      top: `${(120 + 24) * S}px`,
    })
    expect(updates(fake)).toEqual([])
    fireEvent.pointerUp(window)
    await waitFor(() => expect(updates(fake)).toEqual([geometryUpdate({ x: 138, y: 144 })]))
  })

  it('nothing moves before the pointer has gone 3 screen pixels', async () => {
    const { fake, canvas, stage } = await open()
    drag(stage, { x: 500, y: 200 }, [[2, 2]])
    expect(selection(canvas)).toHaveStyle({ left: `${90 * S}px` })
    await new Promise((r) => setTimeout(r, 20))
    expect(updates(fake)).toEqual([])
  })

  it('Escape during a drag cancels it, sends nothing and keeps the selection', async () => {
    const { fake, canvas, stage } = await open()
    // Moved 80 and snapped 10 more, to the canvas's right edge.
    drag(stage, { x: 500, y: 200 }, [[20, 20]], false)
    expect(selection(canvas)).toHaveStyle({ left: `${(90 + 90) * S}px` })
    fireEvent.keyDown(canvas, { key: 'Escape', code: 'Escape' })
    expect(selection(canvas)).toHaveStyle({ left: `${90 * S}px` })
    fireEvent.pointerUp(window)
    fireEvent.click(stage, { clientX: 0, clientY: 0 })
    await new Promise((r) => setTimeout(r, 20))
    expect(updates(fake)).toEqual([])
    expect(selection(canvas)).toHaveAttribute('data-selection', 'L1')
  })

  it('snaps to the canvas edge with a guide; Alt turns snapping off', async () => {
    const { fake, canvas, stage } = await open()
    // Right edge 90 + 80 + 900 = 1070, 10 variant px (2.5 screen px) from the canvas edge.
    drag(stage, { x: 500, y: 200 }, [[20, 0]], false)
    expect(canvas.querySelector('[data-guide="x"]')).toHaveStyle({ left: `${1080 * S}px` })
    fireEvent.pointerMove(window, { clientX: 125 + 20, clientY: 50, altKey: true })
    expect(canvas.querySelector('[data-guide="x"]')).toBeNull()
    fireEvent.pointerUp(window)
    await waitFor(() => expect(updates(fake)).toEqual([geometryUpdate({ x: 170 })]))
  })

  it('a refused update drops the draft and the error reaches the app banner', async () => {
    const { fake, canvas, stage, store } = await open()
    const error = { code: 'NOT_FOUND' as const, message: 'That layer no longer exists.' }
    fake.onCommand('layer.update', () => ({ ok: false, error }))
    drag(stage, { x: 500, y: 200 }, [[20, 20]])
    await waitFor(() => expect(store.getState().error).toBe('That layer no longer exists.'))
    expect(selection(canvas)).toHaveStyle({ left: `${90 * S}px` })
  })
})

describe('Canvas overlay: resizing and rotating [FR-092]', () => {
  it('a corner handle resizes; only the changed fields are sent', async () => {
    const { fake, canvas, stage } = await open()
    await select(canvas, stage, 500, 200)
    drag(handle(canvas, 'se'), { x: 990, y: 320 }, [[10, 10]])
    await waitFor(() =>
      expect(updates(fake)).toEqual([geometryUpdate({ width: 940, height: 240 })]),
    )
  })

  it('the rotation handle turns about the centre; Shift steps by 15°', async () => {
    const { fake, canvas, stage } = await open()
    await select(canvas, stage, 500, 200)
    // The headline's centre is (540, 220); a press straight above it, then to its right.
    drag(handle(canvas, 'rotate'), { x: 540, y: 20 }, [[50, 50]])
    await waitFor(() => expect(updates(fake)).toEqual([geometryUpdate({ rotation: 90 })]))
    // 38.7° from straight up, with Shift: 45°.
    fireEvent.pointerDown(handle(canvas, 'rotate'), { clientX: 135, clientY: 5, button: 0 })
    fireEvent.pointerMove(window, { clientX: 175, clientY: 5, shiftKey: true })
    fireEvent.pointerUp(window)
    await waitFor(() => expect(updates(fake)).toHaveLength(2))
    expect(updates(fake)[1]).toEqual(geometryUpdate({ rotation: 45 }))
  })

  it('a locked layer selected from the list has a box and no handles', async () => {
    const { canvas } = await open(
      variantGet({ layers: [BACKGROUND, { ...HEADLINE, locked: true }] }),
    )
    await userEvent.click(screen.getByRole('button', { name: /^Headline/ }))
    expect(selection(canvas)).toHaveAttribute('data-selection', 'L1')
    expect(canvas.querySelector('[data-handle]')).toBeNull()
  })
})

describe('Canvas overlay: drawing [spec/editor.md "Canvas"]', () => {
  it('draws an "Empty picture" box for a picture layer with no picture, and a danger box for overflow', async () => {
    const { canvas } = await open(
      variantGet({ layers: [BACKGROUND, { ...HEADLINE, overflow: true }, LOGO] }),
    )
    const empty = canvas.querySelector('[data-empty="L2"]')
    expect(empty).toHaveTextContent('Empty picture')
    expect(empty).toHaveStyle({ left: `${800 * S}px`, width: `${200 * S}px` })
    expect(canvas.querySelector('[data-overflow="L1"]')).toHaveStyle({ top: `${120 * S}px` })
    expect(canvas.querySelectorAll('[data-empty], [data-overflow]')).toHaveLength(2)
  })

  it('draws the selection turned with the layer, with eight handles and a rotation handle', async () => {
    const turned = { ...HEADLINE, geometry: { ...HEADLINE.geometry, rotation: 30 } }
    const { canvas, stage } = await open(variantGet({ layers: [BACKGROUND, turned] }))
    await select(canvas, stage, 540, 220)
    expect(selection(canvas)).toHaveStyle({ transform: 'rotate(30deg)' })
    const names = [...canvas.querySelectorAll('[data-handle]')].map((h) =>
      h.getAttribute('data-handle'),
    )
    expect(names).toEqual(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'rotate'])
  })
})

describe('Canvas overlay: keys [FR-097]', () => {
  const press = (canvas: HTMLElement, code: string, mods: object = {}) =>
    fireEvent.keyDown(canvas, { key: code, code, ...mods })

  it.each([
    ['the selected layer', 500, 200, ['L1', 'L1']],
    ['not the background', 40, 900, []],
  ])('Delete and Backspace delete %s', async (_case, x, y, deleted) => {
    const { fake, canvas, stage } = await open()
    await select(canvas, stage, x, y)
    press(canvas, 'Delete')
    press(canvas, 'Backspace')
    const deletes = fake.commands.filter((c) => c.name === 'layer.delete').map((c) => c.input)
    expect(deletes).toEqual(deleted.map((layerId) => ({ projectId: P, layerId })))
  })

  it('does not delete a locked layer', async () => {
    const { fake, canvas } = await open(
      variantGet({ layers: [BACKGROUND, { ...HEADLINE, locked: true }] }),
    )
    await userEvent.click(screen.getByRole('button', { name: /^Headline/ }))
    press(canvas, 'Delete')
    expect(fake.commands.filter((c) => c.name === 'layer.delete')).toEqual([])
  })

  it('Mod+D duplicates as "{name} copy", 20 px right and down, and selects the copy', async () => {
    const { fake, canvas, stage } = await open()
    fake.onCommand('layer.create', () => ({ ok: true, data: { layerId: 'L9' } }))
    await select(canvas, stage, 500, 200)
    press(canvas, 'KeyD', { ctrlKey: true })
    const { style, visible, locked, copy } = HEADLINE
    const geometry = { ...HEADLINE.geometry, x: 110, y: 140 }
    const values = { name: 'Headline copy', style, geometry, visible, locked, copy }
    await waitFor(() =>
      expect(fake.commands.filter((c) => c.name === 'layer.create').map((c) => c.input)).toEqual([
        { projectId: P, variantId: V, type: 'text', values },
      ]),
    )
    await waitFor(() => expect(selection(canvas)).toBeNull())
  })

  it('arrows nudge by 1 and Shift+arrows by 10, gathered into one layer.update', async () => {
    const { fake, canvas, stage } = await open()
    await select(canvas, stage, 500, 200)
    press(canvas, 'ArrowRight')
    press(canvas, 'ArrowRight')
    press(canvas, 'ArrowDown', { shiftKey: true })
    press(canvas, 'ArrowLeft')
    press(canvas, 'ArrowUp')
    expect(selection(canvas)).toHaveStyle({ left: `${91 * S}px`, top: `${129 * S}px` })
    expect(updates(fake)).toEqual([])
    await waitFor(() => expect(updates(fake)).toEqual([geometryUpdate({ x: 91, y: 129 })]), {
      timeout: 1500,
    })
  })

  it('Up and Down in the layer list move the selection, not the layer', async () => {
    const { fake, canvas } = await open()
    await userEvent.click(screen.getByRole('button', { name: /^Headline/ }))
    await userEvent.keyboard('{ArrowUp}')
    expect(selection(canvas)).toHaveAttribute('data-selection', 'L2')
    await new Promise((r) => setTimeout(r, 600))
    expect(updates(fake)).toEqual([])
  })
})
