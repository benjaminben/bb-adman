import { describe, it, expect } from 'vitest'
import { within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axeViolations } from '../../render'
import { createdInput, loadForm, retype } from './brief-form-fixture'

const sizes = (form: HTMLElement) => within(form).getByRole('group', { name: 'Sizes' })
const chip = (form: HTMLElement, name: string) => within(sizes(form)).getByRole('button', { name })
const star = (form: HTMLElement, label: string) => chip(form, `Master: ${label}`)

describe('the brief form: size chips [HOME-3a, AP-5, AP-6]', () => {
  it('draws one toggle chip per ready-made size, named as the old boxes, titled by its pixels', async () => {
    const { form } = await loadForm()
    expect(within(form).getByRole('region', { name: 'Sizes' })).toBeInTheDocument()
    expect(chip(form, '1x1 (1080×1080)')).toHaveAttribute('aria-pressed', 'true')
    expect(chip(form, '9x16 (1080×1920)')).toHaveAttribute('aria-pressed', 'true')
    expect(chip(form, '16x9 (1920×1080)')).toHaveAttribute('aria-pressed', 'false')
    expect(chip(form, '4x5 (1080×1350)')).toHaveAttribute('title', '1080×1350')
    expect(chip(form, '4x5 (1080×1350)')).toHaveTextContent('4x5')
    expect(within(form).queryByRole('combobox', { name: 'Master size' })).toBeNull()
  })

  it('puts a ★ on each chosen chip, pressed on the master, the first chosen by default', async () => {
    const { form } = await loadForm()
    expect(star(form, '1x1')).toHaveAttribute('aria-pressed', 'true')
    expect(star(form, '9x16')).toHaveAttribute('aria-pressed', 'false')
    expect(within(sizes(form)).queryByRole('button', { name: 'Master: 16x9' })).toBeNull()
  })

  it('sends the size whose ★ was pressed as the master, first in the plan', async () => {
    const { fake, form } = await loadForm()
    await userEvent.click(chip(form, '16x9 (1920×1080)'))
    await userEvent.click(star(form, '16x9'))
    expect(star(form, '16x9')).toHaveAttribute('aria-pressed', 'true')
    expect(star(form, '1x1')).toHaveAttribute('aria-pressed', 'false')
    const input = await createdInput(fake)
    expect(input.sizes.map((s) => s.label)).toEqual(['16x9', '1x1', '9x16'])
  })

  it('makes the next chosen size the master when the master chip is turned off', async () => {
    const { fake, form } = await loadForm()
    await userEvent.click(chip(form, '1x1 (1080×1080)'))
    expect(chip(form, '1x1 (1080×1080)')).toHaveAttribute('aria-pressed', 'false')
    expect(star(form, '9x16')).toHaveAttribute('aria-pressed', 'true')
    expect((await createdInput(fake)).sizes.map((s) => s.label)).toEqual(['9x16'])
  })

  it('shows a typed size as a chip with its own ★, and can make it the master', async () => {
    const { fake, form } = await loadForm()
    const other = within(sizes(form)).getByLabelText('Other sizes')
    expect(other).toHaveAttribute('placeholder', '4:5, 1200x628')
    await retype(other, '4:5, 1200x628, huge')
    expect(within(sizes(form)).getAllByTitle('1080×1350')).toHaveLength(2)
    expect(star(form, '4x5')).toHaveAttribute('aria-pressed', 'false')
    expect(within(sizes(form)).queryByRole('button', { name: 'Master: huge' })).toBeNull()
    await retype(other, '4:5, 1200x628')
    await userEvent.click(star(form, '1200x628'))
    expect((await createdInput(fake)).sizes.map((s) => s.label)).toEqual([
      '1200x628',
      '1x1',
      '9x16',
      '4x5',
    ])
  })

  it('keeps the "Other sizes" hint in an InfoTip and as the field description', async () => {
    const { form } = await loadForm()
    const hint = 'Ratios or pixel sizes, separated by commas, for example 4:5 or 1200x628.'
    expect(within(sizes(form)).getByLabelText('Other sizes')).toHaveAccessibleDescription(hint)
    await userEvent.click(within(form).getByRole('button', { name: 'About Other sizes' }))
    expect(within(form).getAllByText(hint).length).toBeGreaterThan(0)
  })

  it('has no axe violations', async () => {
    const { form } = await loadForm()
    await retype(within(sizes(form)).getByLabelText('Other sizes'), '1200x628')
    expect(await axeViolations()).toEqual([])
  })
})
