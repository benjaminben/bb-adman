// spec/editor.md, "Properties panel": colour-choice, the labelled colour field of the Box, Shade
// and Background colour sections: a #RRGGBB field, a colour picker, one button per palette
// colour and an optional "None". Each saves once; a value that is not #RRGGBB goes back.
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ColourChoice, type ColourChoiceProps } from '@/renderer/editor/colour-choice'
import { axeViolations } from '../render'

const PALETTE = ['#E85D2A', '#1B1D22']

function setup(over: Partial<ColourChoiceProps> = {}) {
  const onCommit = vi.fn(async (_value: string | null): Promise<string | null> => null)
  render(
    <main>
      <ColourChoice
        label="Box colour"
        value="#FFFFFF"
        palette={PALETTE}
        disabled={false}
        onCommit={onCommit}
        {...over}
      />
    </main>,
  )
  return { onCommit }
}

const field = () => screen.getByRole('textbox', { name: 'Box colour' })

describe('ColourChoice [spec/editor.md "Properties panel", colour-choice]', () => {
  it('is a group named by its label, with the hex field named the same', () => {
    setup()
    const group = screen.getByRole('group', { name: 'Box colour' })
    expect(within(group).getByRole('textbox', { name: 'Box colour' })).toHaveValue('#FFFFFF')
    expect(within(group).getByLabelText('Box colour picker')).toHaveValue('#ffffff')
  })

  it.each(['{Enter}', '{Tab}'])('a good hex sends once on %s', async (key) => {
    const { onCommit } = setup()
    await userEvent.clear(field())
    await userEvent.type(field(), '#2A7DE8')
    expect(onCommit).not.toHaveBeenCalled()
    await userEvent.keyboard(key)
    expect(onCommit.mock.calls).toEqual([['#2A7DE8']])
  })

  it.each(['red', '#FFF', '#12345G', ''])(
    'a bad hex "%s" sends nothing and goes back',
    async (typed) => {
      const { onCommit } = setup()
      await userEvent.clear(field())
      if (typed) await userEvent.type(field(), typed)
      await userEvent.keyboard('{Enter}')
      expect(onCommit).not.toHaveBeenCalled()
      expect(field()).toHaveValue('#FFFFFF')
    },
  )

  it('the picker saves once, when its choice is made', () => {
    const { onCommit } = setup()
    const picker = screen.getByLabelText('Box colour picker')
    fireEvent.input(picker, { target: { value: '#112233' } })
    expect(onCommit).not.toHaveBeenCalled()
    fireEvent.change(picker, { target: { value: '#112244' } })
    expect(onCommit.mock.calls).toEqual([['#112244']])
  })

  it('a swatch sends its colour and is pressed when it is the value', async () => {
    const { onCommit } = setup({ value: '#1B1D22' })
    const swatch = screen.getByRole('button', { name: 'Palette #E85D2A for box colour' })
    expect(swatch).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Palette #1B1D22 for box colour' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await userEvent.click(swatch)
    expect(onCommit.mock.calls).toEqual([['#E85D2A']])
  })

  it('"None" sends null', async () => {
    const { onCommit } = setup({ allowNone: true })
    await userEvent.click(screen.getByRole('button', { name: 'None' }))
    expect(onCommit.mock.calls).toEqual([[null]])
  })

  it('with no colour, the field is empty and None is pressed', () => {
    setup({ allowNone: true, value: null })
    expect(field()).toHaveValue('')
    expect(screen.getByRole('button', { name: 'None' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('has no "None" unless asked', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'None' })).toBeNull()
  })

  it('a hint describes the hex field', () => {
    setup({ hint: 'Shows under the picture.' })
    expect(field()).toHaveAccessibleDescription('Shows under the picture.')
  })

  it('shows a refusal under the field', async () => {
    setup({ onCommit: async () => 'Those style values do not fit this layer.' })
    await userEvent.click(screen.getByRole('button', { name: 'Palette #E85D2A for box colour' }))
    expect(await screen.findByText('Those style values do not fit this layer.')).toBeInTheDocument()
  })

  it('disabled disables every control', () => {
    setup({ disabled: true, allowNone: true })
    const group = screen.getByRole('group', { name: 'Box colour' })
    for (const control of group.querySelectorAll('input, button')) expect(control).toBeDisabled()
  })

  it('has no axe violations', async () => {
    setup({ allowNone: true, hint: 'Shows under the picture.' })
    expect(await axeViolations()).toEqual([])
  })
})
