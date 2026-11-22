import { describe, it, expect } from 'vitest'
import { within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axeViolations } from '../../render'
import { createdInput, loadForm, problemLines, retype } from './brief-form-fixture'
import { DRAFT, campaign, projectGet } from './project-fixture'

const WORDS = { ...DRAFT, requiredWords: ['sip', 'cool'], prohibitedWords: { de: ['billig'] } }
const rules = (form: HTMLElement) => within(form).getByRole('group', { name: 'Rules' })
const area = (form: HTMLElement, label: string) => within(rules(form)).getByLabelText(label)
const COPY = 'Copy from'
const choice = (form: HTMLElement, name: string) =>
  within(rules(form)).getByRole('button', { name })

async function loadRules(...args: Parameters<typeof loadForm>) {
  const loaded = await loadForm(...args)
  await openRules(loaded.form)
  return loaded
}

// HOME-3a: the Rules Section starts shut (the fold lasts for the session), so open it first.
async function openRules(form: HTMLElement) {
  const head = within(form).getByRole('button', { name: 'Rules' })
  if (head.getAttribute('aria-expanded') === 'false') await userEvent.click(head)
}

describe('the brief form: rules [screens-campaign "The brief form", S2-14, FR-034, A-44]', () => {
  it("shows two word lists per language, filled from the brief's", async () => {
    const { form } = await loadRules(projectGet(), WORDS)
    expect(choice(form, 'Word lists')).toHaveAttribute('aria-pressed', 'true')
    expect(area(form, 'Required words (en)')).toHaveValue('sip\ncool')
    expect(area(form, 'Prohibited words (en)')).toHaveValue('')
    expect(within(rules(form)).queryByLabelText('Required words (de)')).toBeNull()
    await userEvent.click(choice(form, 'de'))
    expect(area(form, 'Required words (de)')).toHaveValue('')
    expect(area(form, 'Prohibited words (de)')).toHaveValue('billig')
    expect(within(rules(form)).queryByLabelText('Required words (en)')).toBeNull()
    await userEvent.click(within(form).getByRole('button', { name: 'About Rules' }))
    expect(form).toHaveTextContent('Colours and required files are set after the campaign is made.')
  })

  it('sends the word lists by language in the brief, and no rule input', async () => {
    const { fake, form } = await loadRules(projectGet(), WORDS)
    await userEvent.click(choice(form, 'de'))
    await userEvent.type(area(form, 'Required words (de)'), 'Erfrischung{Enter}kalt')
    const input = await createdInput(fake)
    expect(input.brief.requiredWords).toEqual({ en: ['sip', 'cool'], de: ['Erfrischung', 'kalt'] })
    expect(input.brief.prohibitedWords).toEqual({ de: ['billig'] })
    expect(input.ruleSet).toBeUndefined()
    expect(input.copyRuleSetFrom).toBeUndefined()
  })

  it('follows the languages typed, and sends no words for a language taken out', async () => {
    const { fake, form } = await loadRules(projectGet(), WORDS)
    await retype(within(form).getByLabelText('Languages'), 'en, fr')
    expect(within(rules(form)).queryByLabelText('Prohibited words (de)')).toBeNull()
    await userEvent.click(choice(form, 'fr'))
    await userEvent.type(area(form, 'Prohibited words (fr)'), 'gratuit')
    const input = await createdInput(fake)
    expect(input.brief.prohibitedWords).toEqual({ fr: ['gratuit'] })
  })

  it('sends copyRuleSetFrom for "Copy the rules from another campaign", and no word lists in the rule input', async () => {
    const reply = projectGet([campaign('C1', 'Spring Launch'), campaign('C2', 'Winter Warmers')])
    const { fake, form } = await loadRules(reply, WORDS)
    await userEvent.click(choice(form, COPY))
    expect(within(rules(form)).queryByLabelText('Required words (en)')).toBeNull()
    expect(problemLines(form)).toEqual(['Choose a campaign to copy the rules from.'])
    const select = within(rules(form)).getByLabelText('Campaign to copy from')
    await userEvent.selectOptions(select, 'Winter Warmers')
    const input = await createdInput(fake)
    expect(input.copyRuleSetFrom).toBe('C2')
    expect(input.ruleSet).toBeUndefined()
  })

  it('disables the copy choice when the project has no other campaign', async () => {
    const { form } = await loadRules()
    expect(choice(form, COPY)).toBeDisabled()
    expect(choice(form, COPY)).toHaveAttribute('title', 'No other campaign yet')
  })

  it.each([
    ['words', false],
    ['copy', true],
  ])('has no axe violations (%s)', async (_, copy) => {
    const { form } = await loadRules(projectGet([campaign('C1', 'Spring Launch')]), WORDS)
    if (copy) await userEvent.click(choice(form, COPY))
    expect(await axeViolations()).toEqual([])
  })
})
