import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { axeViolations } from '../../render'
import { createdInput, loadForm, problemLines, retype } from './brief-form-fixture'

const languages = (form: HTMLElement) => within(form).getByLabelText('Languages')

describe('the brief form: languages [screens-campaign "The brief form", S2-14, FR-026, FR-104]', () => {
  it("shows the brief's languages with the hint", async () => {
    const { form } = await loadForm()
    expect(languages(form)).toHaveValue('en, de')
    expect(languages(form)).toHaveAccessibleDescription(
      "Language tags such as en or fr-CA, separated by commas. The first is the campaign's main language.",
    )
  })

  it('sends the typed tags in order, the first as the main language', async () => {
    const { fake, form } = await loadForm()
    await retype(languages(form), ' fr-CA,en  de,')
    const input = await createdInput(fake)
    expect(input.languages).toEqual(['fr-CA', 'en', 'de'])
    expect(input.brief.languages).toEqual(['fr-CA', 'en', 'de'])
  })

  it.each([
    ['a right-to-left tag', 'en, ar_SA', ['Right-to-left languages are not supported yet.']],
    ['no tag', ' , ', ['Give at least one language.']],
  ])('lists %s as a problem', async (_, typed, expected) => {
    const { form } = await loadForm()
    await retype(languages(form), typed)
    expect(problemLines(form)).toEqual(expected)
    expect(screen.getByRole('button', { name: 'Create campaign' })).toBeDisabled()
  })

  it('has no axe violations', async () => {
    await loadForm()
    expect(await axeViolations()).toEqual([])
  })
})
