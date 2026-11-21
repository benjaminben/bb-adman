// spec/editor.md, "Crop mode" [FR-077, FR-094] (P3-15): double-click or "Crop…" enters; the
// whole picture is shown with the crop and eight handles; the crop keeps the box's shape and
// stays inside the picture; Enter or "Done" sends one layer.update in source pixels; Escape or
// "Cancel" sends nothing; "Reset crop" sends null; a locked layer cannot enter.
import '../../shared/scene/fake-fonts'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Editor } from '@/renderer/editor/editor'
import type { VariantGet } from '@/shared/schemas/queries/variant'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { BACKGROUND, HEADLINE, LOGO, P, V, assetRow, layer, variantGet } from './editor-fixture'

// jsdom has no layout: the canvas draws at 25% with its corner at the page's corner.
const S = 0.25

// A 2000 by 1000 photo in a 200 by 100 box: contained at a tenth, so 1 source pixel is 0.025
// screen pixels, and the crop starts as the whole photo.
const PHOTO = layer({
  id: 'L3',
  variantId: V,
  type: 'image',
  name: 'Lemon photo',
  z: 3,
  source: { assetId: 'A2' },
  geometry: { x: 400, y: 400, width: 200, height: 100, rotation: 0, crop: null },
})
const UNIT = S * 0.1

function reply(photo: Partial<LayerRow> = {}): VariantGet {
  return variantGet({
    layers: [BACKGROUND, HEADLINE, LOGO, { ...PHOTO, ...photo } as LayerRow],
    assets: [assetRow('A1'), assetRow('A2', { width: 2000, height: 1000 })],
  })
}

async function open(data: VariantGet = reply()) {
  const fake = makeFakeApi()
  fake.onQuery('variant.get', () => ({ ok: true, data }))
  fake.onQuery('history.state', () => ({ ok: true, data: { canUndo: false, canRedo: false } }))
  await renderApp(<Editor projectId={P} variantId={V} />, fake)
  const canvas = await screen.findByRole('region', { name: 'Canvas, Master post' })
  return { fake, canvas, stage: canvas.querySelector('[data-stage]') as HTMLElement }
}

const updates = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.commands.filter((c) => c.name === 'layer.update').map((c) => c.input)
const cropBox = () => screen.queryByRole('group', { name: /^Crop/ })
const cropUpdate = (crop: object | null) => ({
  projectId: P,
  layerId: 'L3',
  patch: { geometry: { crop } },
})

// The crop overlay's own picture, loaded at its natural size.
function loadPicture(canvas: HTMLElement, width = 2000, height = 1000) {
  const img = canvas.querySelector('[data-crop-picture]') as HTMLImageElement
  Object.defineProperty(img, 'naturalWidth', { value: width })
  Object.defineProperty(img, 'naturalHeight', { value: height })
  fireEvent.load(img)
  return img
}

async function enter(canvas: HTMLElement, stage: HTMLElement, x = 500, y = 450) {
  fireEvent.doubleClick(stage, { clientX: x * S, clientY: y * S })
  await waitFor(() => expect(canvas.querySelector('[data-crop-picture]')).not.toBeNull())
  loadPicture(canvas)
  await waitFor(() => expect(cropBox()).not.toBeNull())
}

function drag(target: Element, dx: number, dy: number) {
  fireEvent.pointerDown(target, { clientX: 0, clientY: 0, button: 0 })
  fireEvent.pointerMove(window, { clientX: dx, clientY: dy })
  fireEvent.pointerUp(window, { clientX: dx, clientY: dy })
}

const handle = (canvas: HTMLElement, name: string) =>
  canvas.querySelector(`[data-crop-handle="${name}"]`) as HTMLElement

describe('Crop mode: entering [FR-077]', () => {
  it('a double-click on a picture layer shows the whole picture, the crop and eight handles', async () => {
    const { canvas, stage } = await open()
    await enter(canvas, stage)
    const img = canvas.querySelector('[data-crop-picture]') as HTMLImageElement
    expect(img).toHaveStyle({ left: '0px', top: '0px', width: '50px', height: '25px' })
    expect(cropBox()).toHaveStyle({ left: '0px', top: '0px', width: '50px', height: '25px' })
    expect(canvas.querySelectorAll('[data-crop-handle]')).toHaveLength(8)
    expect(cropBox()).toHaveFocus()
    // The normal handles are gone while cropping.
    expect(canvas.querySelector('[data-handle]')).toBeNull()
  })

  it('a locked layer cannot enter, by double-click or by "Crop…"', async () => {
    const { canvas, stage } = await open(reply({ locked: true }))
    fireEvent.doubleClick(stage, { clientX: 500 * S, clientY: 450 * S })
    // A click passes through a locked layer, so the background below it may be cropped instead.
    expect(canvas.querySelector('[data-crop-mode="L3"]')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /^Lemon photo/ }))
    expect(await screen.findByRole('button', { name: 'Crop…' })).toBeDisabled()
  })

  it('a double-click on a text layer or an empty picture does not enter', async () => {
    const { canvas, stage } = await open()
    fireEvent.doubleClick(stage, { clientX: 500 * S, clientY: 200 * S })
    fireEvent.doubleClick(stage, { clientX: 900 * S, clientY: 1200 * S })
    expect(canvas.querySelector('[data-crop-picture]')).toBeNull()
  })

  it('"Crop…" in the properties panel enters', async () => {
    const { canvas } = await open()
    await userEvent.click(screen.getByRole('button', { name: /^Lemon photo/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Crop…' }))
    loadPicture(canvas)
    await waitFor(() => expect(cropBox()).toHaveFocus())
  })
})

describe('Crop mode: the crop [FR-077, FR-094]', () => {
  it('handles resize and a drag inside moves; Enter sends one update in source pixels', async () => {
    const { fake, canvas, stage } = await open()
    await enter(canvas, stage)
    drag(handle(canvas, 'nw'), 200 * UNIT, 100 * UNIT)
    drag(cropBox()!, -100 * UNIT, 0)
    expect(updates(fake)).toEqual([])
    fireEvent.keyDown(cropBox()!, { key: 'Enter', code: 'Enter' })
    await waitFor(() =>
      expect(updates(fake)).toEqual([cropUpdate({ x: 100, y: 100, width: 1800, height: 900 })]),
    )
    expect(canvas.querySelector('[data-crop-picture]')).toBeNull()
  })

  it('keeps the box shape and stays inside the picture', async () => {
    const { fake, canvas, stage } = await open()
    await enter(canvas, stage)
    drag(handle(canvas, 'se'), -1000 * UNIT, -100 * UNIT)
    drag(cropBox()!, 5000 * UNIT, 5000 * UNIT)
    drag(handle(canvas, 'nw'), -9000 * UNIT, 0)
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(updates(fake)).toHaveLength(1))
    const { crop } = (updates(fake)[0] as { patch: { geometry: { crop: Record<string, number> } } })
      .patch.geometry
    expect(crop.width! / crop.height!).toBeCloseTo(2)
    expect(crop.x).toBeGreaterThanOrEqual(0)
    expect(crop.y).toBeGreaterThanOrEqual(0)
    expect(crop.x! + crop.width!).toBeLessThanOrEqual(2000)
    expect(crop.y! + crop.height!).toBeLessThanOrEqual(1000)
  })

  it('Escape sends nothing and leaves crop mode', async () => {
    const { fake, canvas, stage } = await open()
    await enter(canvas, stage)
    drag(handle(canvas, 'nw'), 200 * UNIT, 100 * UNIT)
    await userEvent.keyboard('{Escape}')
    expect(canvas.querySelector('[data-crop-picture]')).toBeNull()
    expect(updates(fake)).toEqual([])
  })

  it('"Cancel" sends nothing and leaves crop mode', async () => {
    const { fake, canvas, stage } = await open()
    await enter(canvas, stage)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(canvas.querySelector('[data-crop-picture]')).toBeNull()
    expect(updates(fake)).toEqual([])
  })

  it('"Done" with the crop the layer already has sends nothing', async () => {
    const crop = { x: 0, y: 0, width: 2000, height: 1000 }
    const { fake, canvas, stage } = await open(reply({ geometry: { ...PHOTO.geometry, crop } }))
    await enter(canvas, stage)
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(canvas.querySelector('[data-crop-picture]')).toBeNull()
    expect(updates(fake)).toEqual([])
  })

  it('selecting another layer leaves crop mode and sends nothing', async () => {
    const { fake, canvas, stage } = await open()
    await enter(canvas, stage)
    await userEvent.click(screen.getByRole('button', { name: /^Headline/ }))
    await waitFor(() => expect(canvas.querySelector('[data-crop-picture]')).toBeNull())
    expect(updates(fake)).toEqual([])
  })

  it('a turned layer is cropped in its own turned frame', async () => {
    const { fake, canvas, stage } = await open(
      reply({ geometry: { ...PHOTO.geometry, rotation: 90 } }),
    )
    await enter(canvas, stage)
    const frame = canvas.querySelector('[data-crop-frame]') as HTMLElement
    expect(frame.style.transform).toBe('rotate(90deg)')
    // Turned a quarter: a pull down the screen is a pull right along the layer's own width.
    drag(handle(canvas, 'nw'), 0, 200 * UNIT)
    fireEvent.keyDown(cropBox()!, { key: 'Enter', code: 'Enter' })
    await waitFor(() => expect(updates(fake)).toHaveLength(1))
    const { crop } = (updates(fake)[0] as { patch: { geometry: { crop: Record<string, number> } } })
      .patch.geometry
    expect(crop.x).toBeCloseTo(200)
    expect(crop.y).toBeCloseTo(100)
    expect(crop.width).toBeCloseTo(1800)
  })
})

describe('Crop mode: the keyboard [8.6]', () => {
  it('arrows move the crop and Shift and arrows resize it, with no nudge of the layer', async () => {
    const { fake, canvas, stage } = await open()
    await enter(canvas, stage)
    await userEvent.keyboard('{Shift>}{ArrowLeft}{ArrowLeft}{/Shift}')
    await userEvent.keyboard('{ArrowRight}{ArrowDown}')
    await userEvent.keyboard('{Delete}')
    await new Promise((done) => setTimeout(done, 600))
    expect(fake.commands.filter((c) => c.name.startsWith('layer.'))).toEqual([])
    await userEvent.keyboard('{Enter}')
    // Shift+Left twice: 20 box pixels narrower (200 source pixels), about the middle; then one
    // box pixel (10 source pixels) right and down.
    await waitFor(() =>
      expect(updates(fake)).toEqual([cropUpdate({ x: 110, y: 60, width: 1800, height: 900 })]),
    )
  })

  it('crop mode passes the accessibility check', async () => {
    const { canvas, stage } = await open()
    await enter(canvas, stage)
    expect(await axeViolations()).toEqual([])
  })
})

describe('Crop mode: the properties panel [FR-094]', () => {
  it('"Reset crop" shows only when a crop is set, and sends null', async () => {
    const { fake } = await open(
      reply({ geometry: { ...PHOTO.geometry, crop: { x: 0, y: 0, width: 1000, height: 500 } } }),
    )
    await userEvent.click(screen.getByRole('button', { name: /^Lemon photo/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Reset crop' }))
    await waitFor(() => expect(updates(fake)).toEqual([cropUpdate(null)]))
  })

  it('"Reset crop" is not shown without a crop', async () => {
    await open()
    await userEvent.click(screen.getByRole('button', { name: /^Lemon photo/ }))
    await screen.findByRole('button', { name: 'Crop…' })
    expect(screen.queryByRole('button', { name: 'Reset crop' })).toBeNull()
  })
})
