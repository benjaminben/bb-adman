// T3d (spec/phases/design-wave.md, "T3d — Fields"; spec/app-style-parts.md "Field"): the number
// field takes `inline`, `unit` and `prefix`. Inline, it is one grid row (label left) and the
// unit sits inside the field box, as text that is not part of the input's name. Without the
// new props the markup is as before.
import fs from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NumberField, type NumberFieldProps } from '@/renderer/editor/number-field'
import layout from '@/renderer/ui/layout.module.css'
import { axeViolations } from '../render'

type Extra = Partial<NumberFieldProps>

// useId gives each mount its own ids; the markup is compared without them.
const withoutIds = (html: string) => html.replace(/(id|for)="[^"]*"/g, '$1=""')

function setup(extra: Extra = {}) {
  const onCommit = vi.fn(async () => null)
  const view = render(
    <main>
      <NumberField label="Size" value={48} onCommit={onCommit} {...extra} />
      <button type="button">Elsewhere</button>
    </main>,
  )
  return {
    ...view,
    field: screen.getByRole('spinbutton', { name: extra.name ?? 'Size' }),
    onCommit,
  }
}

describe('NumberField inline [T3d]', () => {
  it('lays the field out as an inline field with the unit inside the box', () => {
    const { field } = setup({ inline: true, unit: 'px' })
    const box = field.parentElement!
    expect(box).toHaveClass(layout.unitBox as string)
    expect(box.parentElement).toHaveClass(layout.field as string, layout.inline as string)
    const unit = screen.getByText('px')
    expect(unit).toHaveClass(layout.unit as string)
    expect(unit.parentElement).toBe(box)
    expect(field.nextElementSibling).toBe(unit)
  })

  it('keeps the unit and the prefix out of the input name', () => {
    const { field } = setup({ inline: true, unit: 'px', prefix: 'W', name: 'Width' })
    expect(field).toHaveAccessibleName('Width')
    const prefix = screen.getByText('W')
    expect(prefix).toHaveClass(layout.unit as string)
    expect(prefix.nextElementSibling).toBe(field)
  })

  it('keeps its name as the label when inline with a unit', () => {
    const { field } = setup({ inline: true, unit: '%' })
    expect(field).toHaveAccessibleName('Size')
  })

  it('still saves once on Enter', async () => {
    const { field, onCommit } = setup({ inline: true, unit: 'px' })
    await userEvent.clear(field)
    await userEvent.type(field, '64{Enter}')
    expect(onCommit.mock.calls).toEqual([[64]])
  })

  it('sets the digits in tabular figures', () => {
    const { field } = setup({ inline: true, unit: 'px' })
    expect(field.parentElement).toHaveClass(layout.unitBox as string)
    const css = fs.readFileSync(path.resolve('src/renderer/ui/layout.module.css'), 'utf8')
    expect(css).toMatch(/\.unitBox > input \{[^}]*font-variant-numeric: tabular-nums;/)
  })

  it('draws the markup as before without the new props', () => {
    const before = setup({ unit: 'px' })
    expect(before.container.querySelector('label + div > input + span')).not.toBeNull()
    const html = withoutIds(before.container.innerHTML)
    before.unmount()
    const again = setup({ unit: 'px', inline: false })
    expect(withoutIds(again.container.innerHTML)).toBe(html)
    expect(html).not.toContain(layout.unitBox as string)
    expect(html).not.toContain(layout.inline as string)
  })

  it('has no accessibility violations inline', async () => {
    setup({ inline: true, unit: 'px', prefix: 'X', name: 'X position' })
    expect(await axeViolations()).toEqual([])
  })
})
