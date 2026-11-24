// T3d (spec/phases/design-wave.md, "T3d — Fields"; spec/app-style-parts.md "Field", "Swatch
// field", D-109): one round swatch per palette colour, "No colour" first when allowed, and "+"
// last. "+" and the chosen swatch open the app's own colour picker (picker tests are in
// swatch-picker.test.tsx). The part writes nothing to the project itself: it only calls
// onCommit, and only with a valid hex (or null).
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SwatchField } from '@/renderer/ui/swatch-field'
import { axeViolations } from '../render'

const PALETTE = ['#1a2b3c', '#e85d3f', '#f4f1ea']

function setup(given: { value?: string | null; allowNone?: boolean; disabled?: boolean } = {}) {
  const onCommit = vi.fn()
  const view = render(
    <main>
      <SwatchField
        label="Box colour"
        value={given.value === undefined ? '#e85d3f' : given.value}
        palette={PALETTE}
        allowNone={given.allowNone}
        disabled={given.disabled}
        onCommit={onCommit}
      />
    </main>,
  )
  const group = screen.getByRole('group', { name: 'Box colour' })
  return { ...view, group, onCommit }
}

async function openPopover() {
  await userEvent.click(screen.getByRole('button', { name: 'Other colour' }))
  return screen.getByRole('textbox', { name: 'Hex colour' })
}

describe('SwatchField [T3d]', () => {
  it('draws one swatch per palette colour, named by its hex, the chosen one pressed', () => {
    const { group } = setup()
    const names = within(group)
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label') ?? b.textContent)
    expect(names).toEqual([...PALETTE, 'Other colour'])
    expect(screen.getByRole('button', { name: '#e85d3f' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '#1a2b3c' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows a current colour that is not in the palette after the palette, pressed', () => {
    const { group } = setup({ value: '#0A0B0C' })
    const names = within(group)
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label') ?? b.textContent)
    expect(names).toEqual([...PALETTE, '#0A0B0C', 'Other colour'])
    expect(screen.getByRole('button', { name: '#0A0B0C' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('adds no extra swatch for a current colour the palette holds in another letter case', () => {
    const { group } = setup({ value: '#E85D3F' })
    expect(within(group).getAllByRole('button')).toHaveLength(PALETTE.length + 1)
  })

  it('puts "No colour" first only with allowNone, pressed when there is no colour', () => {
    const { group, unmount } = setup({ allowNone: true, value: null })
    const first = within(group).getAllByRole('button')[0]
    expect(first).toHaveAccessibleName('No colour')
    expect(first).toHaveAttribute('aria-pressed', 'true')
    unmount()
    setup()
    expect(screen.queryByRole('button', { name: 'No colour' })).toBeNull()
  })

  it.each([
    ['a palette colour', '#1a2b3c', '#1a2b3c'],
    ['No colour', 'No colour', null],
  ])('commits %s once when it is clicked', async (_case, name, sent) => {
    const { onCommit } = setup({ allowNone: true })
    await userEvent.click(screen.getByRole('button', { name }))
    expect(onCommit.mock.calls).toEqual([[sent]])
  })

  it('opens the popover from "+" with the square, the hue slider and the hex field', async () => {
    setup()
    const plus = screen.getByRole('button', { name: 'Other colour' })
    expect(plus).toHaveAttribute('aria-expanded', 'false')
    const hex = await openPopover()
    expect(plus).toHaveAttribute('aria-expanded', 'true')
    expect(hex).toHaveValue('#e85d3f')
    expect(hex).toHaveFocus()
    expect(screen.getByRole('slider', { name: 'Saturation and brightness' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Hue' })).toBeInTheDocument()
  })

  it('commits a valid hex once, in #rrggbb, and closes the popover', async () => {
    const { onCommit } = setup()
    const hex = await openPopover()
    await userEvent.clear(hex)
    await userEvent.type(hex, '#00AA55{Enter}')
    expect(onCommit.mock.calls).toEqual([['#00AA55']])
    expect(screen.queryByRole('textbox', { name: 'Hex colour' })).toBeNull()
  })

  it('shows one line for an invalid hex and commits nothing', async () => {
    const { onCommit } = setup()
    const hex = await openPopover()
    await userEvent.clear(hex)
    await userEvent.type(hex, 'orange{Enter}')
    expect(onCommit).not.toHaveBeenCalled()
    const line = screen.getByText('Use a colour like #1A2B3C.')
    expect(hex).toHaveAccessibleDescription('Use a colour like #1A2B3C.')
    expect(hex).toHaveValue('orange')
    expect(line.tagName).toBe('P')
  })

  it('opens the popover from the chosen swatch and saves nothing [D-109]', async () => {
    const { onCommit } = setup()
    const chosen = screen.getByRole('button', { name: '#e85d3f' })
    await userEvent.click(chosen)
    expect(screen.getByRole('textbox', { name: 'Hex colour' })).toHaveValue('#e85d3f')
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('saves another swatch once, without opening the popover [D-109]', async () => {
    const { onCommit } = setup()
    await userEvent.click(screen.getByRole('button', { name: '#1a2b3c' }))
    expect(onCommit.mock.calls).toEqual([['#1a2b3c']])
    expect(screen.queryByRole('textbox', { name: 'Hex colour' })).toBeNull()
  })

  it('on Escape gives the focus back to the chosen swatch that opened it, saving nothing', async () => {
    const { onCommit } = setup()
    await userEvent.click(screen.getByRole('button', { name: '#e85d3f' }))
    expect(screen.getByRole('textbox', { name: 'Hex colour' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('textbox', { name: 'Hex colour' })).toBeNull()
    expect(screen.getByRole('button', { name: '#e85d3f' })).toHaveFocus()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('closes on a press outside and saves nothing', async () => {
    const { onCommit } = setup()
    const hex = await openPopover()
    await userEvent.clear(hex)
    await userEvent.type(hex, '#00AA55')
    await userEvent.click(document.body)
    expect(screen.queryByRole('textbox', { name: 'Hex colour' })).toBeNull()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('has no element of type color, closed or open [D-109]', async () => {
    const { container } = setup()
    expect(container.querySelector('input[type="color"]')).toBeNull()
    await openPopover()
    expect(document.querySelector('input[type="color"]')).toBeNull()
  })

  it('closes the popover on Escape and gives the focus back to "+"', async () => {
    setup()
    await openPopover()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('textbox', { name: 'Hex colour' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Other colour' })).toHaveFocus()
  })

  it('disables every swatch', () => {
    const { group } = setup({ disabled: true, allowNone: true })
    for (const b of within(group).getAllByRole('button')) expect(b).toBeDisabled()
  })

  it('has no accessibility violations, closed and open', async () => {
    setup({ allowNone: true })
    expect(await axeViolations()).toEqual([])
    await openPopover()
    expect(await axeViolations()).toEqual([])
  })
})
