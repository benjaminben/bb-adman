// spec/editor.md, "Properties panel", "Shade" [D-094], for image and background layers: a select
// (None, From the bottom, From the top, From the left, From the right, Whole picture), then
// Colour, Strength (0 to 100 %) and Reach (5 to 100 %, disabled for Whole picture). Choosing a
// side when there is none sends NEW_SHADE with that side; None sends shade null; every change
// sends the whole shade; each slider saves once when it is let go.
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ShadeFields } from '@/renderer/editor/shade-fields'
import { NEW_SHADE } from '@/shared/config/look'
import type { LayerPatch } from '@/shared/schemas/commands/layer'
import type { Shade } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { axeViolations } from '../render'
import { BACKGROUND, LOGO } from './editor-fixture'

const PALETTE = ['#E85D2A', '#1B1D22']
const SHADE: Shade = { color: '#1B1D22', from: 'left', strength: 0.5, reach: 0.4 }
const shaded = (shade: Shade, layer: LayerRow = LOGO): LayerRow => ({
  ...layer,
  style: { opacity: 1, shade },
})

function setup(layer: LayerRow = LOGO) {
  const onUpdate = vi.fn(async (_patch: LayerPatch): Promise<string | null> => null)
  render(
    <main>
      <ShadeFields layer={layer} palette={PALETTE} onUpdate={onUpdate} />
    </main>,
  )
  return { onUpdate }
}

const select = () => screen.getByRole('combobox', { name: 'Shade' })
const spin = (name: string) => screen.getByRole('spinbutton', { name })
const slider = (name: string) => screen.getByRole('slider', { name })

describe('ShadeFields [spec/editor.md "Properties panel", Shade; D-094]', () => {
  it('a layer with no shade shows None and no other field', () => {
    setup()
    expect(select()).toHaveValue('none')
    expect(Array.from(select().querySelectorAll('option')).map((o) => o.textContent)).toEqual([
      'None',
      'From the bottom',
      'From the top',
      'From the left',
      'From the right',
      'Whole picture',
    ])
    expect(screen.queryByRole('spinbutton', { name: 'Strength' })).toBeNull()
  })

  it.each([
    ['top', 'From the top'],
    ['all', 'Whole picture'],
  ] as const)('None to %s sends NEW_SHADE with that side', async (from, name) => {
    const { onUpdate } = setup()
    await userEvent.selectOptions(select(), name)
    expect(onUpdate.mock.calls).toEqual([[{ style: { shade: { ...NEW_SHADE, from } } }]])
  })

  it('shows a stored shade in percent', () => {
    setup(shaded(SHADE))
    expect(select()).toHaveValue('left')
    expect(screen.getByRole('textbox', { name: 'Colour' })).toHaveValue('#1B1D22')
    expect(spin('Strength')).toHaveValue('50')
    expect(spin('Reach')).toHaveValue('40')
    expect(slider('Strength')).toHaveValue('50')
  })

  it('a fresh background shows its starting shade', () => {
    setup(shaded(NEW_SHADE, BACKGROUND))
    expect(select()).toHaveValue('bottom')
    expect(spin('Strength')).toHaveValue('70')
  })

  it.each([
    ['side', async () => userEvent.selectOptions(select(), 'From the right'), { from: 'right' }],
    [
      'colour',
      async () =>
        userEvent.click(screen.getByRole('button', { name: 'Palette #E85D2A for colour' })),
      { color: '#E85D2A' },
    ],
    [
      'strength',
      async () => {
        await userEvent.clear(spin('Strength'))
        await userEvent.type(spin('Strength'), '85{Enter}')
      },
      { strength: 0.85 },
    ],
    [
      'reach',
      async () => {
        await userEvent.clear(spin('Reach'))
        await userEvent.type(spin('Reach'), '2{Enter}')
      },
      { reach: 0.05 },
    ],
  ])('changing the %s sends the whole shade', async (_name, act, change) => {
    const { onUpdate } = setup(shaded(SHADE))
    await act()
    expect(onUpdate.mock.calls).toEqual([[{ style: { shade: { ...SHADE, ...change } } }]])
  })

  it.each(['Strength', 'Reach'])('the %s slider sends once on release', async (name) => {
    const { onUpdate } = setup(shaded(SHADE))
    fireEvent.change(slider(name), { target: { value: '30' } })
    fireEvent.change(slider(name), { target: { value: '35' } })
    expect(onUpdate).not.toHaveBeenCalled()
    fireEvent.pointerUp(slider(name))
    fireEvent.blur(slider(name))
    const key = name === 'Strength' ? 'strength' : 'reach'
    expect(onUpdate.mock.calls).toEqual([[{ style: { shade: { ...SHADE, [key]: 0.35 } } }]])
  })

  it('Reach is disabled for Whole picture', () => {
    setup(shaded({ ...SHADE, from: 'all' }))
    expect(spin('Reach')).toBeDisabled()
    expect(slider('Reach')).toBeDisabled()
    expect(spin('Strength')).toBeEnabled()
  })

  it('None sends shade null', async () => {
    const { onUpdate } = setup(shaded(SHADE))
    await userEvent.selectOptions(select(), 'None')
    expect(onUpdate.mock.calls).toEqual([[{ style: { shade: null } }]])
  })

  it('a locked layer has every field disabled', () => {
    setup({ ...shaded(SHADE), locked: true })
    const group = screen.getByRole('group', { name: 'Shade' })
    for (const control of group.querySelectorAll('input, button, select')) {
      expect(control).toBeDisabled()
    }
  })

  it('has no axe violations', async () => {
    setup(shaded(SHADE))
    expect(await axeViolations()).toEqual([])
  })
})
