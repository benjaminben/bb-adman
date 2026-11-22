// T3d (spec/phases/design-wave.md, "T3d — Fields"; spec/app-style-parts.md "Field", "Slider
// field"): a range and a small number on one row, named by one label. Dragging moves the
// number and saves nothing; release (the range's change), Enter in the number or leaving it
// saves once.
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SliderField } from '@/renderer/ui/slider-field'
import { axeViolations } from '../render'

function setup(given: { value?: number; disabled?: boolean } = {}) {
  const onCommit = vi.fn()
  const view = render(
    <main>
      <SliderField
        label="Opacity"
        value={given.value ?? 60}
        min={0}
        max={100}
        step={1}
        unit="%"
        disabled={given.disabled}
        onCommit={onCommit}
      />
      <button type="button">Elsewhere</button>
    </main>,
  )
  const range = screen.getByRole('slider', { name: 'Opacity' })
  const number = screen.getByRole('spinbutton', { name: 'Opacity value' })
  return { ...view, range, number, onCommit }
}

describe('SliderField [T3d]', () => {
  it('names the range and the number with one label', () => {
    const { range, number } = setup()
    expect(range).toHaveValue('60')
    expect(number).toHaveValue('60')
    expect(screen.getByText('Opacity')).toBeVisible()
    expect(screen.getByText('%')).toBeVisible()
  })

  // A move is an `input` event; the browser fires `change` when the drag or key press ends.
  it('moves the number while dragging and saves once on release', () => {
    const { range, number, onCommit } = setup()
    fireEvent.pointerDown(range)
    fireEvent.input(range, { target: { value: '70' } })
    fireEvent.input(range, { target: { value: '75' } })
    expect(number).toHaveValue('75')
    expect(onCommit).not.toHaveBeenCalled()
    fireEvent.pointerUp(range)
    fireEvent.change(range, { target: { value: '75' } })
    expect(onCommit.mock.calls).toEqual([[75]])
  })

  it('saves a range moved with the keys once, on its change', () => {
    const { range, onCommit } = setup()
    fireEvent.input(range, { target: { value: '61' } })
    expect(onCommit).not.toHaveBeenCalled()
    fireEvent.change(range, { target: { value: '61' } })
    expect(onCommit.mock.calls).toEqual([[61]])
  })

  it.each([
    ['Enter', '{Enter}'],
    ['leaving the number', '{Tab}'],
  ])('saves the typed number once on %s', async (_how, keys) => {
    const { range, number, onCommit } = setup()
    await userEvent.clear(number)
    await userEvent.type(number, '42')
    expect(onCommit).not.toHaveBeenCalled()
    await userEvent.keyboard(keys)
    await userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }))
    expect(onCommit.mock.calls).toEqual([[42]])
    expect(range).toHaveValue('42')
  })

  it.each([
    ['above the maximum', '250', 100],
    ['below the minimum', '-5', 0],
  ])('holds a value %s to the bound', async (_case, typed, sent) => {
    const { number, onCommit } = setup()
    await userEvent.clear(number)
    await userEvent.type(number, `${typed}{Enter}`)
    expect(onCommit.mock.calls).toEqual([[sent]])
    expect(number).toHaveValue(String(sent))
  })

  it('sends nothing for an unchanged value or text that is not a number', async () => {
    const { number, onCommit } = setup()
    await userEvent.type(number, '{Enter}')
    await userEvent.clear(number)
    await userEvent.type(number, 'lots{Enter}')
    expect(onCommit).not.toHaveBeenCalled()
    expect(number).toHaveValue('60')
  })

  it('takes a new stored value', () => {
    const { rerender, onCommit } = setup()
    rerender(
      <SliderField label="Opacity" value={30} min={0} max={100} step={1} onCommit={onCommit} />,
    )
    expect(screen.getByRole('slider', { name: 'Opacity' })).toHaveValue('30')
    expect(screen.getByRole('spinbutton', { name: 'Opacity value' })).toHaveValue('30')
  })

  it('disables both controls', () => {
    const { range, number } = setup({ disabled: true })
    expect(range).toBeDisabled()
    expect(number).toBeDisabled()
  })

  it('has no accessibility violations', async () => {
    setup()
    expect(await axeViolations()).toEqual([])
  })
})
