// spec/editor.md, "Properties panel", "Text", Colour; ED-2 (spec/phases/design-wave-screens-a.md,
// "Text layer"): the colour is the shared swatch field. A palette swatch, the "+" popover's
// "Hex colour" (on Enter) or its own colour picker (on release or Enter, D-109) each send one
// layer.update.
// Moved from text-fields.test.tsx by ED-2 to keep that file under 300 lines.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TextFields } from '@/renderer/editor/text-fields'
import { HEADLINE } from './editor-fixture'

const PALETTE = ['#E85D2A', '#1B1D22']

function setup() {
  const onUpdate = vi.fn(async () => null)
  render(
    <main>
      <TextFields layer={HEADLINE} palette={PALETTE} font={null} onUpdate={onUpdate} />
      <button type="button">Elsewhere</button>
    </main>,
  )
  return { onUpdate }
}

const elsewhere = () => userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }))

describe('TextFields: Colour [spec/editor.md "Properties panel", Text; ED-2]', () => {
  // ED-2: the colour is a swatch field; other colours are typed in its "+" popover.
  const otherColour = () =>
    userEvent.click(
      within(screen.getByRole('group', { name: 'Colour' })).getByRole('button', {
        name: 'Other colour',
      }),
    )

  it('Colour: "Hex colour" sends one layer.update on Enter, not per keystroke', async () => {
    const { onUpdate } = setup()
    await otherColour()
    const field = screen.getByRole('textbox', { name: 'Hex colour' })
    await userEvent.clear(field)
    await userEvent.type(field, '#2A7DE8')
    expect(onUpdate).not.toHaveBeenCalled()
    await userEvent.keyboard('{Enter}')
    await elsewhere()
    expect(onUpdate.mock.calls).toEqual([[{ style: { color: '#2A7DE8' } }]])
  })

  it('a colour that is not #RRGGBB sends nothing', async () => {
    const { onUpdate } = setup()
    await otherColour()
    const field = screen.getByRole('textbox', { name: 'Hex colour' })
    await userEvent.clear(field)
    await userEvent.type(field, 'orange{Enter}')
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('the colour picker saves once, when its choice is made [D-109]', async () => {
    const { onUpdate } = setup()
    await otherColour()
    await userEvent.clear(screen.getByRole('textbox', { name: 'Hex colour' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Hex colour' }), '#000000')
    screen.getByRole('slider', { name: 'Saturation and brightness' }).focus()
    await userEvent.keyboard('{Shift>}{ArrowUp}{ArrowUp}{/Shift}')
    expect(onUpdate).not.toHaveBeenCalled()
    await userEvent.keyboard('{Enter}')
    expect(onUpdate.mock.calls).toEqual([[{ style: { color: '#333333' } }]])
  })

  it('one button per palette colour, each sending that colour', async () => {
    const { onUpdate } = setup()
    await userEvent.click(screen.getByRole('button', { name: '#E85D2A' }))
    expect(screen.getByRole('button', { name: '#1B1D22' })).toBeInTheDocument()
    expect(onUpdate.mock.calls).toEqual([[{ style: { color: '#E85D2A' } }]])
  })
})
