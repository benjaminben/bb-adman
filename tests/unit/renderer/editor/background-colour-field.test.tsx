// spec/editor.md, "Properties panel", Picture, background only: "Background colour", a
// colour-choice with the palette and no "None", hinted "Shows under the picture." A layer with no
// colour shows #000000, which is how it draws. Each change is one layer.update of fillColor.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BackgroundColourField } from '@/renderer/editor/background-colour-field'
import type { LayerPatch } from '@/shared/schemas/commands/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { axeViolations } from '../render'
import { BACKGROUND, LOGO } from './editor-fixture'

const PALETTE = ['#E85D2A', '#1B1D22']

function setup(layer: LayerRow = BACKGROUND) {
  const onUpdate = vi.fn(async (_patch: LayerPatch): Promise<string | null> => null)
  render(
    <main>
      <BackgroundColourField layer={layer} palette={PALETTE} onUpdate={onUpdate} />
    </main>,
  )
  return { onUpdate }
}

const field = () => screen.getByRole('textbox', { name: 'Background colour' })

describe('BackgroundColourField [spec/editor.md "Properties panel", Picture]', () => {
  it.each([
    ['absent', { opacity: 1 }],
    ['null', { opacity: 1, fillColor: null }],
  ])('shows #000000 when the colour is %s, with its hint and no None', (_name, style) => {
    setup({ ...BACKGROUND, style })
    expect(field()).toHaveValue('#000000')
    expect(field()).toHaveAccessibleDescription('Shows under the picture.')
    expect(screen.queryByRole('button', { name: 'None' })).toBeNull()
  })

  it('shows the stored colour', () => {
    setup({ ...BACKGROUND, style: { opacity: 1, fillColor: '#F4E9D8' } })
    expect(field()).toHaveValue('#F4E9D8')
  })

  it.each([
    ['a typed hex', async () => userEvent.type(field(), '{Control>}a{/Control}#2A7DE8{Enter}'), '#2A7DE8'],
    [
      'a swatch',
      async () =>
        userEvent.click(screen.getByRole('button', { name: 'Palette #E85D2A for background colour' })),
      '#E85D2A',
    ],
  ])('%s sends one layer.update of fillColor', async (_name, act, fillColor) => {
    const { onUpdate } = setup()
    await act()
    expect(onUpdate.mock.calls).toEqual([[{ style: { fillColor } }]])
  })

  it('is shown for the background only', () => {
    setup(LOGO)
    expect(screen.queryByRole('textbox', { name: 'Background colour' })).toBeNull()
  })

  it('a locked background has the field disabled', () => {
    setup({ ...BACKGROUND, locked: true })
    expect(field()).toBeDisabled()
  })

  it('has no axe violations', async () => {
    setup()
    expect(await axeViolations()).toEqual([])
  })
})
