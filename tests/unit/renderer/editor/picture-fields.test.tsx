// spec/editor.md, "Properties panel", "Picture" [REQ: FR-094]: the picture small and whole with
// its display name, or "Empty picture"; "Choose picture…" opens the picture chooser; "Remove
// picture" sets source to null; "Opacity" as a slider and a number, 0 to 100 %, stored 0 to 1;
// the background's "Fill the canvas" and "Fit inside", each one layer.update.
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PictureFields, type PictureAsset } from '@/renderer/editor/picture-fields'
import type { LayerPatch } from '@/shared/schemas/commands/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { BACKGROUND, LOGO, P, assetRow } from './editor-fixture'

const CANVAS = { width: 1080, height: 1350 }
const picture = (over: Partial<PictureAsset> = {}): PictureAsset => ({
  displayName: 'summer-hero.jpg',
  kind: 'image',
  missing: false,
  width: 2000,
  height: 1000,
  version: 0,
  ...over,
})

type Options = { layer?: LayerRow; asset?: PictureAsset | null }

async function setup(options: Options = {}) {
  const fake = makeFakeApi()
  fake.onQuery('asset.list', () => ({
    ok: true,
    data: [assetRow('A7', { displayName: 'lemon-splash.png' })],
  }))
  const onUpdate = vi.fn(async (_patch: LayerPatch): Promise<string | null> => null)
  const layer = options.layer ?? { ...LOGO, source: { assetId: 'A1' } }
  await renderApp(
    <main>
      <PictureFields
        projectId={P}
        layer={layer}
        asset={options.asset === undefined ? picture() : options.asset}
        canvas={CANVAS}
        onUpdate={onUpdate}
      />
    </main>,
    fake,
  )
  return { fake, onUpdate }
}

const button = (name: string) => screen.getByRole('button', { name })

describe('PictureFields [spec/editor.md "Properties panel", Picture; FR-094]', () => {
  it('shows the picture whole and small with its display name as text', async () => {
    await setup({ asset: picture({ displayName: '<b>summer-hero.jpg</b>' }) })
    const group = screen.getByRole('group', { name: 'Picture' })
    expect(within(group).getByText('<b>summer-hero.jpg</b>')).toBeInTheDocument()
    const img = group.querySelector('img')
    expect(img?.getAttribute('src')).toBe(`adman-asset://${P}/A1`)
    expect(img?.getAttribute('alt')).toBe('')
  })

  it('an empty picture layer says "Empty picture" and cannot remove its picture', async () => {
    await setup({ layer: LOGO, asset: null })
    expect(screen.getByText('Empty picture')).toBeInTheDocument()
    expect(button('Remove picture')).toBeDisabled()
    expect(button('Choose picture…')).toBeEnabled()
  })

  it('a missing picture shows its name and "file not found", and no image', async () => {
    await setup({ asset: picture({ missing: true }) })
    const group = screen.getByRole('group', { name: 'Picture' })
    expect(within(group).getByText('summer-hero.jpg')).toBeInTheDocument()
    expect(within(group).getByText('file not found')).toBeInTheDocument()
    expect(group.querySelector('img')).toBeNull()
  })

  it('Remove picture sends source null', async () => {
    const { onUpdate } = await setup()
    await userEvent.click(button('Remove picture'))
    expect(onUpdate.mock.calls).toEqual([[{ source: null }]])
  })

  it('Choose picture… opens the chooser; choosing sends the source and focus goes back', async () => {
    const { onUpdate } = await setup()
    await userEvent.click(button('Choose picture…'))
    const dialog = await screen.findByRole('dialog', { name: 'Choose a picture for Logo' })
    await userEvent.click(await within(dialog).findByRole('button', { name: 'lemon-splash.png' }))
    expect(onUpdate.mock.calls).toEqual([[{ source: { assetId: 'A7' } }]])
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(button('Choose picture…')).toHaveFocus()
  })

  it('the opacity number shows 0 to 100 and saves 0 to 1 on Enter', async () => {
    const { onUpdate } = await setup({ layer: { ...LOGO, style: { opacity: 0.8 } } })
    const field = screen.getByRole('spinbutton', { name: 'Opacity' })
    expect(field).toHaveValue('80')
    await userEvent.clear(field)
    await userEvent.type(field, '45{Enter}')
    expect(onUpdate.mock.calls).toEqual([[{ style: { opacity: 0.45 } }]])
  })

  it('the opacity number keeps within 0 to 100', async () => {
    const { onUpdate } = await setup()
    const field = screen.getByRole('spinbutton', { name: 'Opacity' })
    await userEvent.clear(field)
    await userEvent.type(field, '140{Enter}')
    expect(onUpdate.mock.calls).toEqual([])
    await userEvent.clear(field)
    await userEvent.type(field, '-5{Enter}')
    expect(onUpdate.mock.calls).toEqual([[{ style: { opacity: 0 } }]])
  })

  it.each([
    ['pointerUp', () => fireEvent.pointerUp(screen.getByRole('slider', { name: 'Opacity' }))],
    ['keyUp', () => fireEvent.keyUp(screen.getByRole('slider', { name: 'Opacity' }))],
    ['blur', () => fireEvent.blur(screen.getByRole('slider', { name: 'Opacity' }))],
  ])('the opacity slider saves once on %s, not while it moves', async (_name, release) => {
    const { onUpdate } = await setup()
    const slider = screen.getByRole('slider', { name: 'Opacity' })
    expect(slider).toHaveValue('100')
    fireEvent.change(slider, { target: { value: '40' } })
    fireEvent.change(slider, { target: { value: '30' } })
    expect(onUpdate).not.toHaveBeenCalled()
    release()
    release()
    expect(onUpdate.mock.calls).toEqual([[{ style: { opacity: 0.3 } }]])
  })

  it.each([
    ['Fill the canvas', picture(), { x: 0, y: 0, width: 1080, height: 1350 }],
    [
      'Fit inside',
      picture({ width: 2000, height: 1000 }),
      { x: 0, y: 405, width: 1080, height: 540 },
    ],
    [
      'Fit inside',
      picture({ width: 600, height: 1000 }),
      { x: 135, y: 0, width: 810, height: 1350 },
    ],
    [
      'Fit inside',
      picture({ width: 333, height: 1000 }),
      { x: 315, y: 0, width: 450, height: 1350 },
    ],
  ])("the background's %s sends one update with the geometry", async (name, asset, box) => {
    const layer = {
      ...BACKGROUND,
      geometry: {
        ...BACKGROUND.geometry,
        rotation: 12,
        crop: { x: 1, y: 2, width: 30, height: 40 },
      },
    }
    const { onUpdate } = await setup({ layer, asset })
    await userEvent.click(button(name))
    expect(onUpdate.mock.calls).toEqual([[{ geometry: { ...box, rotation: 0, crop: null } }]])
  })

  it("Fit inside is off while the picture's shape is unknown", async () => {
    await setup({ layer: { ...BACKGROUND, source: null }, asset: null })
    expect(button('Fit inside')).toBeDisabled()
    expect(button('Fill the canvas')).toBeEnabled()
  })

  it('a picture layer has no background buttons', async () => {
    await setup()
    expect(screen.queryByRole('button', { name: 'Fill the canvas' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Fit inside' })).toBeNull()
  })

  it('a locked layer shows every field disabled', async () => {
    await setup({ layer: { ...BACKGROUND, locked: true } })
    for (const name of ['Choose picture…', 'Remove picture', 'Fill the canvas', 'Fit inside']) {
      expect(button(name)).toBeDisabled()
    }
    expect(screen.getByRole('slider', { name: 'Opacity' })).toBeDisabled()
    expect(screen.getByRole('spinbutton', { name: 'Opacity' })).toBeDisabled()
  })

  it('a refused update shows its message', async () => {
    const { onUpdate } = await setup()
    onUpdate.mockResolvedValueOnce('That layer is locked.')
    await userEvent.click(button('Remove picture'))
    expect(await screen.findByText('That layer is locked.')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    await setup({ layer: BACKGROUND })
    expect(await axeViolations()).toEqual([])
  })
})

// LK-5: "Background colour" in the background's Picture section, with the palette passed through.
describe('PictureFields, Background colour [spec/editor.md "Properties panel", Picture; LK-5]', () => {
  async function withPalette(layer: LayerRow) {
    const onUpdate = vi.fn(async (_patch: LayerPatch): Promise<string | null> => null)
    await renderApp(
      <main>
        <PictureFields
          projectId={P}
          layer={layer}
          asset={picture()}
          canvas={CANVAS}
          palette={['#E85D2A']}
          onUpdate={onUpdate}
        />
      </main>,
    )
    return { onUpdate }
  }

  it('the background shows it inside Picture, with the palette, sending fillColor', async () => {
    const { onUpdate } = await withPalette(BACKGROUND)
    const group = screen.getByRole('group', { name: 'Picture' })
    expect(within(group).getByRole('textbox', { name: 'Background colour' })).toHaveValue('#000000')
    await userEvent.click(
      within(group).getByRole('button', { name: 'Palette #E85D2A for background colour' }),
    )
    expect(onUpdate.mock.calls).toEqual([[{ style: { fillColor: '#E85D2A' } }]])
  })

  it('a picture layer has no background colour', async () => {
    await withPalette({ ...LOGO, source: { assetId: 'A1' } })
    expect(screen.queryByRole('textbox', { name: 'Background colour' })).toBeNull()
  })
})
