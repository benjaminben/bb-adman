import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axeViolations } from '../../render'
import { createdInput, loadForm, problemLines, retype } from './brief-form-fixture'

const sizes = (form: HTMLElement) => within(form).getByRole('group', { name: 'Sizes' })
const box = (form: HTMLElement, label: string) =>
  within(sizes(form)).getByRole('button', { name: label })
const pressed = (button: HTMLElement) => button.getAttribute('aria-pressed') === 'true'
const stars = (form: HTMLElement) =>
  within(sizes(form)).getAllByRole('button', { name: /^Master: / })

describe('the brief form: sizes [screens-campaign "The brief form", S2-14, FR-026]', () => {
  it("ticks the brief's ready-made sizes, one box per ready-made size", async () => {
    const { form } = await loadForm()
    expect(box(form, '1x1 (1080×1080)')).toHaveAttribute('aria-pressed', 'true')
    expect(box(form, '9x16 (1080×1920)')).toHaveAttribute('aria-pressed', 'true')
    expect(box(form, '16x9 (1920×1080)')).toHaveAttribute('aria-pressed', 'false')
    expect(box(form, '4x5 (1080×1350)')).toHaveAttribute('aria-pressed', 'false')
    const other = within(sizes(form)).getByLabelText('Other sizes')
    expect(other).toHaveValue('')
    expect(other).toHaveAccessibleDescription(
      'Ratios or pixel sizes, separated by commas, for example 4:5 or 1200x628.',
    )
  })

  it('lists the chosen sizes in order as the master choices, and sends the master first', async () => {
    const { fake, form } = await loadForm()
    await userEvent.click(box(form, '9x16 (1080×1920)'))
    await userEvent.click(box(form, '4x5 (1080×1350)'))
    await retype(within(sizes(form)).getByLabelText('Other sizes'), '1200x628, 1.91:1')
    expect(stars(form).map((s) => s.getAttribute('aria-label'))).toEqual([
      'Master: 1x1',
      'Master: 4x5',
      'Master: 1200x628',
      'Master: 2063x1080',
    ])
    expect(
      stars(form)
        .filter(pressed)
        .map((s) => s.getAttribute('aria-label')),
    ).toEqual(['Master: 1x1'])
    await userEvent.click(within(sizes(form)).getByRole('button', { name: 'Master: 1200x628' }))
    const input = await createdInput(fake)
    expect(input.sizes.map((s) => s.label)).toEqual(['1200x628', '1x1', '4x5', '2063x1080'])
    expect(input.brief.sizes).toEqual(['1200x628', '1080x1080', '1080x1350', '2063x1080'])
  })

  it('makes the first chosen size the master when the master is unticked', async () => {
    const { fake, form } = await loadForm()
    await userEvent.click(box(form, '1x1 (1080×1080)'))
    expect(within(sizes(form)).getByRole('button', { name: 'Master: 9x16' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect((await createdInput(fake)).sizes.map((s) => s.label)).toEqual(['9x16'])
  })

  it.each([
    ['an unreadable size', ['1x1 (1080×1080)'], 'huge', ['The size "huge" cannot be read.']],
    ['no size', ['1x1 (1080×1080)', '9x16 (1080×1920)'], '', ['Choose at least one size.']],
  ])('lists %s as a problem', async (_, untick, typed, expected) => {
    const { form } = await loadForm()
    for (const label of untick) await userEvent.click(box(form, label))
    await retype(within(sizes(form)).getByLabelText('Other sizes'), typed)
    expect(problemLines(form)).toEqual(expected)
    expect(screen.getByRole('button', { name: 'Create campaign' })).toBeDisabled()
  })

  it('has no axe violations', async () => {
    await loadForm()
    expect(await axeViolations()).toEqual([])
  })
})
