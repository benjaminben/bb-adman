// spec/editor.md, "Properties panel": a number field saves once on Enter or on leaving it, never
// per keystroke; whole numbers unless a step says otherwise; steps with the arrow keys; a refused
// value shows the message under the field and the field goes back to the stored value.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NumberField } from '@/renderer/editor/number-field'
import { axeViolations } from '../render'

type Given = { value?: number; step?: number; min?: number; max?: number; refuse?: string }

function setup(given: Given = {}) {
  const onCommit = vi.fn(async () => given.refuse ?? null)
  const view = render(
    <main>
      <NumberField
        label="Size"
        unit="px"
        value={given.value ?? 48}
        step={given.step}
        min={given.min}
        max={given.max}
        onCommit={onCommit}
      />
      <button type="button">Elsewhere</button>
    </main>,
  )
  const field = screen.getByRole('spinbutton', { name: 'Size' })
  return { ...view, field, onCommit }
}

describe('NumberField [spec/editor.md "Properties panel"]', () => {
  it.each([
    ['Enter', '{Enter}'],
    ['leaving the field', '{Tab}'],
  ])('saves once on %s, not per keystroke', async (_how, keys) => {
    const { field, onCommit } = setup()
    await userEvent.clear(field)
    await userEvent.type(field, '64')
    expect(onCommit).not.toHaveBeenCalled()
    await userEvent.keyboard(keys)
    await userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }))
    expect(onCommit.mock.calls).toEqual([[64]])
  })

  it.each([
    ['an unchanged value', '48', 48],
    ['text that is not a number', 'big', 48],
    ['an empty field', '', 48],
  ])('sends nothing for %s and shows the stored value', async (_case, typed, shown) => {
    const { field, onCommit } = setup()
    await userEvent.clear(field)
    if (typed) await userEvent.type(field, typed)
    await userEvent.keyboard('{Enter}')
    expect(onCommit).not.toHaveBeenCalled()
    expect(field).toHaveValue(String(shown))
  })

  it.each([
    ['whole numbers by default', {}, '12.6', 13],
    ['to the step', { step: 0.05, value: 1.2 }, '1.234', 1.25],
    ['up to the maximum', { step: 0.01, min: -0.2, max: 1, value: 0 }, '3', 1],
    ['down to the minimum', { step: 0.01, min: -0.2, max: 1, value: 0 }, '-0.5', -0.2],
  ])('rounds and bounds the value: %s', async (_case, given: Given, typed, sent) => {
    const { field, onCommit } = setup(given)
    await userEvent.clear(field)
    await userEvent.type(field, `${typed}{Enter}`)
    expect(onCommit.mock.calls).toEqual([[sent]])
  })

  it('steps with the arrow keys within the bounds, and saves on Enter', async () => {
    const { field, onCommit } = setup({ step: 0.01, min: -0.2, max: 1, value: 0.98 })
    await userEvent.click(field)
    await userEvent.keyboard('{ArrowUp}')
    expect(field).toHaveValue('0.99')
    await userEvent.keyboard('{ArrowUp}{ArrowUp}')
    expect(field).toHaveValue('1')
    await userEvent.keyboard('{ArrowDown}')
    expect(field).toHaveValue('0.99')
    expect(onCommit).not.toHaveBeenCalled()
    await userEvent.keyboard('{Enter}')
    expect(onCommit.mock.calls).toEqual([[0.99]])
  })

  it('shows a refusal under the field and goes back to the stored value', async () => {
    const { field } = setup({ refuse: 'Those style values do not fit this layer.' })
    await userEvent.clear(field)
    await userEvent.type(field, '70{Enter}')
    expect(await screen.findByText('Those style values do not fit this layer.')).toBeInTheDocument()
    expect(field).toHaveValue('48')
    expect(field).toHaveAccessibleDescription('Those style values do not fit this layer.')
  })

  it('takes the new stored value when it changes', async () => {
    const { rerender, onCommit } = setup()
    rerender(<NumberField label="Size" value={72} onCommit={onCommit} />)
    expect(screen.getByRole('spinbutton', { name: 'Size' })).toHaveValue('72')
  })

  it('has no accessibility violations', async () => {
    setup()
    expect(await axeViolations()).toEqual([])
  })
})
