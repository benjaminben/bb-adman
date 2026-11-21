// spec/editor.md "Top bar", "Layout…" (LK-6) [D-094]: the layout dialog lists the starter
// layouts with a preview each; Apply sends one layer.updateMany built by starterLayoutPatches.
import '../../shared/scene/fake-fonts'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LayoutDialog } from '@/renderer/dialogs/layout-dialog'
import { STARTER_LAYOUTS } from '@/shared/config/starter-layouts'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { starterLayoutPatches } from '@/shared/templates/starter-layout-patches'
import { layer } from '../../shared/scene/fixtures'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { P, variant } from '../screens/campaign/campaign-fixture'

const VARIANT = variant('V1', { width: 1080, height: 1920, sizeLabel: '9:16' })
const WHOLE = { x: 0, y: 0, width: 1080, height: 1920, rotation: 0, crop: null }
const LAYERS: LayerRow[] = [
  layer({ id: 'background', type: 'background', z: 0, geometry: WHOLE }),
  layer({ id: 'subject-image', type: 'image', z: 1 }),
  layer({ id: 'logo', type: 'image', z: 2 }),
  layer({ id: 'headline', type: 'text', z: 3, copy: 'Cool down this summer' }),
  layer({ id: 'call-to-action', type: 'text', z: 4, copy: 'Shop now' }),
]

async function open(layers = LAYERS, fake = makeFakeApi()) {
  const onClose = vi.fn()
  const view = await renderApp(
    <LayoutDialog
      open
      projectId={P}
      variant={VARIANT}
      layers={layers}
      assets={{}}
      onClose={onClose}
    />,
    fake,
  )
  await screen.findByRole('dialog', { name: 'Choose a layout' })
  return { ...view, onClose }
}

const sent = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.commands.filter((c) => c.name === 'layer.updateMany').map((c) => c.input)

describe('LayoutDialog [spec/editor.md "Layout…", LK-6]', () => {
  it('lists the five layouts by name and description, the first chosen, with a preview each', async () => {
    await open()
    const choices = screen.getAllByRole('radio')
    expect(choices).toHaveLength(5)
    STARTER_LAYOUTS.forEach((layout, i) => {
      expect(choices[i]).toHaveAccessibleName(layout.name)
      expect(choices[i]).toHaveAccessibleDescription(layout.description)
    })
    expect(choices[0]).toBeChecked()
    expect(document.querySelectorAll('[data-layout-preview]')).toHaveLength(5)
    expect(screen.getByText('Locked layers stay as they are.')).toBeInTheDocument()
    expect(await axeViolations()).toEqual([])
  })

  it.each([0, 3])('Apply sends one layer.updateMany for layout %i and closes', async (i) => {
    const { fake, onClose } = await open()
    const layout = STARTER_LAYOUTS[i]
    await userEvent.click(screen.getByRole('radio', { name: layout.name }))
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    const updates = starterLayoutPatches(layout, VARIANT, LAYERS)
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect(sent(fake)).toEqual([{ projectId: P, variantId: 'V1', updates }])
    expect(updates.length).toBeGreaterThan(0)
  })

  it('shows a refusal in the dialog and stays open', async () => {
    const fake = makeFakeApi()
    fake.onCommand('layer.updateMany', () => ({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'Those style values do not fit this layer.' },
    }))
    const { onClose } = await open(LAYERS, fake)
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Those style values do not fit this layer.',
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('says the layout changes no layer and disables Apply when every named layer is locked', async () => {
    const extra = layer({ id: 'my-text', type: 'text', z: 5 })
    const locked = [...LAYERS.map((l) => ({ ...l, locked: true })), extra]
    const { fake } = await open(locked)
    expect(screen.getByText('This layout changes no layer here.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
    expect(sent(fake)).toEqual([])
  })

  it.each([
    ['Cancel', () => userEvent.click(screen.getByRole('button', { name: 'Cancel' }))],
    ['Escape', () => userEvent.keyboard('{Escape}')],
  ])('%s sends nothing and closes', async (_c, act) => {
    const { fake, onClose } = await open()
    await act()
    expect(onClose).toHaveBeenCalledOnce()
    expect(sent(fake)).toEqual([])
  })
})
