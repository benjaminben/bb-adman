// spec/app-style-parts.md, "Swatch field", "The popover" and "Draft and save" (D-109): the app's
// own colour picker. The square and the hue slider change a draft only; the draft is saved
// once on pointer release or on Enter, and the popover stays open. Enter in "Hex colour"
// saves upper case and closes. Escape and a press outside save nothing.
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SwatchField } from '@/renderer/ui/swatch-field'
import { hexToHsb, hsbToHex } from '@/renderer/ui/swatch-field/colour-maths'
import { axeViolations } from '../render'

const VALUE = '#e85d3f'
const HUE = hexToHsb(VALUE).h

async function setup() {
  const onCommit = vi.fn()
  render(
    <main>
      <SwatchField label="Box colour" value={VALUE} palette={['#1a2b3c']} onCommit={onCommit} />
    </main>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Other colour' }))
  return { onCommit }
}

const square = () => screen.getByRole('slider', { name: 'Saturation and brightness' })
const hue = () => screen.getByRole('slider', { name: 'Hue' })
const hexField = () => screen.getByRole('textbox', { name: 'Hex colour' })

// jsdom has no layout: give the element a 100 by 100 box at the page's top left.
function sized(el: HTMLElement) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({ width: 100, height: 100 }),
  )
  return el
}

function drag(el: HTMLElement, points: [number, number][]) {
  const [first, ...rest] = points
  fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: first?.[0], clientY: first?.[1] })
  for (const [x, y] of rest) fireEvent.pointerMove(el, { pointerId: 1, clientX: x, clientY: y })
  const last = points[points.length - 1]
  fireEvent.pointerUp(el, { pointerId: 1, button: 0, clientX: last?.[0], clientY: last?.[1] })
}

describe('SwatchField picker [D-109]', () => {
  it('names the square by its saturation and brightness', async () => {
    await setup()
    const { s, b } = hexToHsb(VALUE)
    expect(square()).toHaveAttribute(
      'aria-valuetext',
      `Saturation ${Math.round(s)}%, brightness ${Math.round(b)}%`,
    )
    expect(hue()).toHaveAttribute('aria-valuenow', String(Math.round(HUE)))
    expect(hue()).toHaveAttribute('aria-valuemin', '0')
    expect(hue()).toHaveAttribute('aria-valuemax', '360')
  })

  it('arrow keys in the square change the draft and save nothing until Enter', async () => {
    const { onCommit } = await setup()
    const { s, b } = hexToHsb(VALUE)
    square().focus()
    await userEvent.keyboard('{ArrowRight}{Shift>}{ArrowDown}{/Shift}')
    const draft = hsbToHex({ h: HUE, s: Math.round(s) + 1, b: Math.round(b) - 10 })
    expect(square()).toHaveAttribute(
      'aria-valuetext',
      `Saturation ${Math.round(s) + 1}%, brightness ${Math.round(b) - 10}%`,
    )
    expect(hexField()).toHaveValue(draft.toLowerCase())
    expect(onCommit).not.toHaveBeenCalled()
    await userEvent.keyboard('{Enter}')
    expect(onCommit.mock.calls).toEqual([[draft]])
    expect(square()).toBeInTheDocument()
  })

  it('a pointer drag in the square saves exactly once, on release', async () => {
    const { onCommit } = await setup()
    const el = sized(square())
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 50, clientY: 25 })
    expect(onCommit).not.toHaveBeenCalled()
    fireEvent.pointerUp(el, { pointerId: 1, button: 0, clientX: 50, clientY: 25 })
    expect(onCommit.mock.calls).toEqual([[hsbToHex({ h: HUE, s: 50, b: 75 })]])
    expect(square()).toBeInTheDocument()
  })

  it('the hue slider changes the draft by keys and saves on Enter', async () => {
    const { onCommit } = await setup()
    hue().focus()
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}')
    expect(hue()).toHaveAttribute('aria-valuenow', String(Math.round(HUE) + 10))
    expect(onCommit).not.toHaveBeenCalled()
    await userEvent.keyboard('{Enter}')
    const { s, b } = hexToHsb(VALUE)
    expect(onCommit.mock.calls).toEqual([[hsbToHex({ h: Math.round(HUE) + 10, s, b })]])
  })

  it('a pointer drag on the hue slider saves exactly once, on release', async () => {
    const { onCommit } = await setup()
    drag(sized(hue()), [
      [10, 5],
      [30, 5],
      [50, 5],
    ])
    const { s, b } = hexToHsb(VALUE)
    expect(onCommit.mock.calls).toEqual([[hsbToHex({ h: 180, s, b })]])
  })

  it('Enter in "Hex colour" saves upper case and closes', async () => {
    const { onCommit } = await setup()
    await userEvent.clear(hexField())
    await userEvent.type(hexField(), '#00aa55{Enter}')
    expect(onCommit.mock.calls).toEqual([['#00AA55']])
    expect(screen.queryByRole('slider', { name: 'Hue' })).toBeNull()
  })

  it('a bad hex shows the line and saves nothing', async () => {
    const { onCommit } = await setup()
    await userEvent.clear(hexField())
    await userEvent.type(hexField(), '#12{Enter}')
    expect(screen.getByText('Use a colour like #1A2B3C.')).toBeInTheDocument()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('Escape after a change in the square saves nothing', async () => {
    const { onCommit } = await setup()
    square().focus()
    await userEvent.keyboard('{ArrowUp}{Escape}')
    expect(screen.queryByRole('slider', { name: 'Hue' })).toBeNull()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('shows the draft colour as a swatch', async () => {
    await setup()
    expect(screen.getByTestId('swatch-draft')).toHaveStyle({ background: VALUE })
  })

  it('has no accessibility violations', async () => {
    await setup()
    expect(await axeViolations()).toEqual([])
  })
})
