// spec/editor.md, "Properties panel", "Box" [D-094]: Vertical align, All capitals, Box colour,
// Outline colour (each with "None"), Outline width (0 to 100), Corner radius and Padding (0 to
// 2,000). Each field sends one layer.update with that field only. A layer stored without the
// fields shows the defaults; a locked layer's fields are all disabled.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TextBoxFields } from '@/renderer/editor/text-box-fields'
import type { LayerPatch } from '@/shared/schemas/commands/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { axeViolations } from '../render'
import { HEADLINE } from './editor-fixture'

const PALETTE = ['#E85D2A', '#1B1D22']
const BOXED: LayerRow = {
  ...HEADLINE,
  style: {
    ...(HEADLINE.style as object),
    verticalAlign: 'middle',
    allCaps: true,
    boxColor: '#FFFFFF',
    boxOutlineColor: '#1B1D22',
    boxOutlineWidth: 4,
    boxRadius: 24,
    boxPadding: 32,
  } as LayerRow['style'],
}

function setup(layer: LayerRow = HEADLINE) {
  const onUpdate = vi.fn(async (_patch: LayerPatch): Promise<string | null> => null)
  render(
    <main>
      <TextBoxFields layer={layer} palette={PALETTE} onUpdate={onUpdate} />
    </main>,
  )
  return { onUpdate }
}

const group = () => screen.getByRole('group', { name: 'Box' })
const spin = (name: string) => screen.getByRole('spinbutton', { name })
const colour = (name: string) => screen.getByRole('group', { name })

describe('TextBoxFields [spec/editor.md "Properties panel", Box; D-094]', () => {
  it('a layer stored without the fields shows the defaults', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Top' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('checkbox', { name: 'All capitals' })).not.toBeChecked()
    for (const name of ['Box colour', 'Outline colour']) {
      expect(within(colour(name)).getByRole('textbox', { name })).toHaveValue('')
      expect(within(colour(name)).getByRole('button', { name: 'None' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    }
    expect(spin('Outline width')).toHaveValue('0')
    expect(spin('Corner radius')).toHaveValue('0')
    expect(spin('Padding')).toHaveValue('0')
  })

  it('shows the stored values', () => {
    setup(BOXED)
    expect(screen.getByRole('button', { name: 'Middle' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('checkbox', { name: 'All capitals' })).toBeChecked()
    expect(screen.getByRole('textbox', { name: 'Box colour' })).toHaveValue('#FFFFFF')
    expect(screen.getByRole('textbox', { name: 'Outline colour' })).toHaveValue('#1B1D22')
    expect(spin('Outline width')).toHaveValue('4')
    expect(spin('Corner radius')).toHaveValue('24')
    expect(spin('Padding')).toHaveValue('32')
  })

  it.each([
    ['Bottom', { verticalAlign: 'bottom' }],
    ['Middle', { verticalAlign: 'middle' }],
  ])('"%s" sends one layer.update with verticalAlign only', async (name, style) => {
    const { onUpdate } = setup()
    await userEvent.click(screen.getByRole('button', { name }))
    expect(onUpdate.mock.calls).toEqual([[{ style }]])
  })

  it('All capitals sends allCaps only', async () => {
    const { onUpdate } = setup()
    await userEvent.click(screen.getByRole('checkbox', { name: 'All capitals' }))
    expect(onUpdate.mock.calls).toEqual([[{ style: { allCaps: true } }]])
  })

  it.each([
    ['Box colour', '#FFFFFF', { boxColor: '#FFFFFF' }],
    ['Outline colour', '#1B1D22', { boxOutlineColor: '#1B1D22' }],
  ])('%s sends its field only', async (name, typed, style) => {
    const { onUpdate } = setup()
    await userEvent.type(screen.getByRole('textbox', { name }), `${typed}{Enter}`)
    expect(onUpdate.mock.calls).toEqual([[{ style }]])
  })

  it.each([
    ['Box colour', { boxColor: null }],
    ['Outline colour', { boxOutlineColor: null }],
  ])('%s "None" sends null', async (name, style) => {
    const { onUpdate } = setup(BOXED)
    await userEvent.click(within(colour(name)).getByRole('button', { name: 'None' }))
    expect(onUpdate.mock.calls).toEqual([[{ style }]])
  })

  it.each([
    ['Outline width', '12', { boxOutlineWidth: 12 }],
    ['Outline width', '150', { boxOutlineWidth: 100 }],
    ['Outline width', '-3', null],
    ['Corner radius', '40', { boxRadius: 40 }],
    ['Corner radius', '2500', { boxRadius: 2000 }],
    ['Padding', '16', { boxPadding: 16 }],
    ['Padding', '9000', { boxPadding: 2000 }],
  ])('%s "%s" is kept in bounds and sends its field only', async (name, typed, style) => {
    const { onUpdate } = setup()
    await userEvent.clear(spin(name))
    await userEvent.type(spin(name), `${typed}{Enter}`)
    expect(onUpdate.mock.calls).toEqual(style ? [[{ style }]] : [])
  })

  it('a locked layer has every field disabled', () => {
    setup({ ...BOXED, locked: true })
    for (const control of group().querySelectorAll('input, button')) expect(control).toBeDisabled()
  })

  it('has no axe violations', async () => {
    setup(BOXED)
    expect(await axeViolations()).toEqual([])
  })
})
