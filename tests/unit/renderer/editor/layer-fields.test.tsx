// spec/editor.md, "Properties panel", "Layer": Name, Visible and Locked, and Bring forward, Send
// backward, Duplicate and Delete layer (none of these four for the background). A locked
// layer's other fields are shown but disabled.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LayerFields } from '@/renderer/editor/layer-fields'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { axeViolations } from '../render'
import { BACKGROUND, HEADLINE } from './editor-fixture'

type Options = { layer?: LayerRow; canForward?: boolean; canBackward?: boolean; refuse?: string }

function setup(options: Options = {}) {
  const handlers = {
    onUpdate: vi.fn(async () => options.refuse ?? null),
    onForward: vi.fn(),
    onBackward: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
  }
  render(
    <main>
      <LayerFields
        layer={options.layer ?? HEADLINE}
        canForward={options.canForward ?? true}
        canBackward={options.canBackward ?? true}
        {...handlers}
      />
      <button type="button">Elsewhere</button>
    </main>,
  )
  return handlers
}

const nameField = () => screen.getByRole('textbox', { name: 'Name' })
const button = (name: string) => screen.queryByRole('button', { name })

describe('LayerFields [spec/editor.md "Properties panel", Layer]', () => {
  it.each([
    ['Enter', '{Enter}'],
    ['leaving the field', '{Tab}'],
  ])('the name saves once on %s, trimmed', async (_how, keys) => {
    const { onUpdate } = setup()
    await userEvent.clear(nameField())
    await userEvent.type(nameField(), '  Summer headline ')
    expect(onUpdate).not.toHaveBeenCalled()
    await userEvent.keyboard(keys)
    await userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }))
    expect(onUpdate.mock.calls).toEqual([[{ name: 'Summer headline' }]])
  })

  it('an empty name sends nothing and goes back to the stored name', async () => {
    const { onUpdate } = setup()
    await userEvent.clear(nameField())
    await userEvent.keyboard('{Enter}')
    expect(onUpdate).not.toHaveBeenCalled()
    expect(nameField()).toHaveValue('Headline')
  })

  it('a refused name shows the message under the field and goes back', async () => {
    setup({ refuse: 'A layer name has 1 to 100 characters.' })
    await userEvent.type(nameField(), ' two{Enter}')
    expect(await screen.findByText('A layer name has 1 to 100 characters.')).toBeInTheDocument()
    expect(nameField()).toHaveValue('Headline')
  })

  it.each([
    ['Visible', { visible: false }],
    ['Locked', { locked: true }],
  ])('the %s check box sends one layer.update', async (name, patch) => {
    const { onUpdate } = setup()
    await userEvent.click(screen.getByRole('checkbox', { name }))
    expect(onUpdate.mock.calls).toEqual([[patch]])
  })

  it.each([
    ['Bring forward', 'onForward'],
    ['Send backward', 'onBackward'],
    ['Duplicate', 'onDuplicate'],
    ['Delete layer', 'onDelete'],
  ] as const)('%s calls its action', async (name, handler) => {
    const handlers = setup()
    await userEvent.click(button(name)!)
    expect(handlers[handler]).toHaveBeenCalledTimes(1)
  })

  it('cannot bring the top layer forward or send the lowest backward', () => {
    setup({ canForward: false, canBackward: false })
    expect(button('Bring forward')).toBeDisabled()
    expect(button('Send backward')).toBeDisabled()
  })

  it('a locked layer: the other fields are shown but disabled; Locked and Duplicate stay', () => {
    setup({ layer: { ...HEADLINE, locked: true } })
    expect(nameField()).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Visible' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Locked' })).toBeEnabled()
    expect(screen.getByRole('checkbox', { name: 'Locked' })).toBeChecked()
    for (const name of ['Bring forward', 'Send backward', 'Delete layer'])
      expect(button(name)).toBeDisabled()
    expect(button('Duplicate')).toBeEnabled()
  })

  it('the background has no delete, duplicate or reorder', () => {
    setup({ layer: BACKGROUND })
    for (const name of ['Bring forward', 'Send backward', 'Duplicate', 'Delete layer'])
      expect(button(name)).toBeNull()
    expect(nameField()).toHaveValue('Background')
  })

  it('has no accessibility violations', async () => {
    setup()
    expect(await axeViolations()).toEqual([])
  })
})
