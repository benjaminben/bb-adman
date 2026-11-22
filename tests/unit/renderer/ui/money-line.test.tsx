// T4 (spec/app-style-parts.md, "Dialog", MoneyLine): the one way to show a cost. It draws only
// the words it is given, as text, and its id makes them the dialog's accessible description.
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import { MoneyLine } from '@/renderer/ui/money-line'
import { axeViolations } from '../render'

describe('MoneyLine [T4, C-15]', () => {
  it('draws the coin icon and the given words, and carries its id', () => {
    const { container } = render(<MoneyLine id="run-cost">Paid: 2 videos</MoneyLine>)
    const line = container.querySelector('#run-cost')
    expect(line).toHaveTextContent('Paid: 2 videos')
    expect(line?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('is the accessible description of a dialog whose describedBy is its id', async () => {
    render(
      <main>
        <DialogFrame open title="Make pictures" describedBy="run-cost" onClose={() => {}}>
          <MoneyLine id="run-cost">Paid: 4 pictures → Fal Studio</MoneyLine>
        </DialogFrame>
      </main>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Make pictures' })
    expect(dialog).toHaveAccessibleDescription('Paid: 4 pictures to Fal Studio')
    expect(await axeViolations()).toEqual([])
  })

  it('reads the arrow form with "to" and draws the arrow as a hidden icon', () => {
    const { container } = render(
      <MoneyLine id="cost">Paid: 4 pictures + 2 references → Fal Studio</MoneyLine>,
    )
    const line = container.querySelector('#cost')
    expect(line?.textContent).toBe('Paid: 4 pictures + 2 references to Fal Studio')
    expect(line?.textContent).not.toContain('→')
    expect(line?.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(2)
  })

  it('draws markup in its words as text, never as HTML', () => {
    const { container } = render(
      <MoneyLine id="cost">{'Paid: <img src=x onerror=alert(1)> → <b>Fal</b>'}</MoneyLine>,
    )
    const line = container.querySelector('#cost')
    expect(line?.querySelector('img, b')).toBeNull()
    expect(line?.textContent).toBe('Paid: <img src=x onerror=alert(1)> to <b>Fal</b>')
  })

  it('is one line in the warn colours, with no control of its own', () => {
    const { container } = render(<MoneyLine id="cost">Paid: 1 picture → Fal Studio</MoneyLine>)
    expect(container.querySelector('button, a, input')).toBeNull()
  })
})
