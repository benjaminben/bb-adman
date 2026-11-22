import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { starterTemplate } from '@/shared/templates/starter'
import { axeViolations } from '../../render'
import { createdInput, loadForm, problemLines, retype } from './brief-form-fixture'
import { DRAFT, PROJECT, campaign, projectGet } from './project-fixture'

const field = (form: HTMLElement, name: string) => within(form).getByLabelText(name)
const rulesRegion = (form: HTMLElement) => within(form).getByRole('region', { name: 'Rules' })
const rulesButton = (form: HTMLElement) =>
  within(rulesRegion(form)).getByRole('button', { name: 'Rules' })

async function openRules(form: HTMLElement) {
  if (rulesButton(form).getAttribute('aria-expanded') === 'false')
    await userEvent.click(rulesButton(form))
}

describe('the brief form: campaign fields [HOME-3a]', () => {
  it('shows short visible labels and keeps the old names', async () => {
    const { form } = await loadForm()
    for (const words of [
      'Name',
      'Region',
      'Audience',
      'Message',
      'Offer',
      'Call to action',
      'Tone',
    ])
      expect(within(form).getAllByText(words, { exact: true }).length).toBeGreaterThan(0)
    expect(field(form, 'Campaign name')).toHaveValue(DRAFT.campaignName)
    for (const name of ['Offer (optional)', 'Call to action (optional)', 'Tone (optional)'])
      expect(field(form, name)).toHaveAttribute('placeholder', 'Optional')
  })
})

describe('the brief form: languages [HOME-3a]', () => {
  it('shows the parsed languages as chips, ★ on the first, a pencil where copy was given', async () => {
    const { form } = await loadForm(projectGet(), { ...DRAFT, copy: { de: { headline: 'Hallo' } } })
    const chips = within(form).getByRole('list', { name: 'Languages in order' })
    const items = within(chips).getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual(['en', 'de'])
    expect(within(items[0]!).getByTitle('Main language')).toBeInTheDocument()
    expect(within(items[1]!).queryByTitle('Main language')).toBeNull()
    expect(within(items[1]!).getByTitle('Copy given')).toBeInTheDocument()
    expect(within(items[0]!).queryByTitle('Copy given')).toBeNull()
    expect(form).not.toHaveTextContent('Copy given for')
    expect(field(form, 'Languages')).toHaveAttribute('placeholder', 'en, fr-CA')
    expect(within(form).getByRole('button', { name: 'About Languages' })).toBeInTheDocument()
  })
})

describe('the brief form: rules [HOME-3a]', () => {
  it('starts closed with a summary that the rules exist, and opens on a click', async () => {
    const words = { ...DRAFT, requiredWords: ['sip', 'cool'], prohibitedWords: { de: ['billig'] } }
    const { form } = await loadForm(projectGet(), words)
    expect(rulesButton(form)).toHaveAttribute('aria-expanded', 'false')
    expect(rulesRegion(form)).toHaveTextContent('2 required · 1 prohibited')
    expect(within(form).queryByRole('group', { name: 'Rules' })).toBeNull()
    await userEvent.click(rulesButton(form))
    expect(within(form).getByRole('group', { name: 'Rules' })).toBeVisible()
    expect(within(form).getByRole('button', { name: 'Word lists' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(field(form, 'Required words (en)')).toHaveAttribute('placeholder', 'One per line')
    expect(within(form).getByRole('button', { name: 'About Rules' })).toBeInTheDocument()
  })

  it('summarises a copy as "From {campaign}"', async () => {
    const reply = projectGet([campaign('C1', 'Spring Launch'), campaign('C2', 'Winter Warmers')])
    const { form } = await loadForm(reply)
    await openRules(form)
    await userEvent.click(within(form).getByRole('button', { name: 'Copy from' }))
    await userEvent.selectOptions(field(form, 'Campaign to copy from'), 'Winter Warmers')
    expect(rulesRegion(form)).toHaveTextContent('From Winter Warmers')
  })

  it('disables "Copy from" with its reason when there is no other campaign', async () => {
    const { form } = await loadForm()
    await openRules(form)
    const copy = within(form).getByRole('button', { name: 'Copy from' })
    expect(copy).toBeDisabled()
    expect(copy).toHaveAttribute('title', 'No other campaign yet')
  })

  it('keeps a rules problem in the list while the section is shut', async () => {
    const { form } = await loadForm(projectGet([campaign('C1', 'Spring Launch')]))
    await openRules(form)
    await userEvent.click(within(form).getByRole('button', { name: 'Copy from' }))
    await userEvent.click(rulesButton(form))
    expect(rulesButton(form)).toHaveAttribute('aria-expanded', 'false')
    expect(problemLines(form)).toEqual(['Choose a campaign to copy the rules from.'])
  })
})

describe('the brief form: problems and the foot [HOME-3a, OI-DW-2]', () => {
  it('lists every problem word for word under "To fix", with a mark in the foot that leads there', async () => {
    const { form } = await loadForm(projectGet(), { ...DRAFT, audience: undefined, message: '' })
    await retype(field(form, 'Languages'), '')
    const expected = ['Enter the audience.', 'Enter the message.', 'Give at least one language.']
    expect(problemLines(form)).toEqual(expected)
    const heading = within(form).getByRole('heading', { name: 'To fix', level: 3 })
    const create = screen.getByRole('button', { name: 'Create campaign' })
    expect(create).toBeDisabled()
    expect(create).toHaveAttribute('title', 'Fix the 3 problems first')
    const mark = within(form).getByRole('button', { name: '3 to fix: go to the list' })
    expect(mark).toHaveTextContent('3 to fix')
    await userEvent.click(mark)
    expect(heading).toHaveFocus()
  })

  it('shows no mark and no title when there is nothing to fix', async () => {
    const { form } = await loadForm()
    expect(within(form).queryByRole('button', { name: /to fix/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Create campaign' })).not.toHaveAttribute('title')
  })

  it('has no axe violations with problems and the rules open', async () => {
    const { form } = await loadForm(projectGet(), { ...DRAFT, audience: undefined })
    await openRules(form)
    expect(await axeViolations()).toEqual([])
  })
})

describe('what "Create campaign" sends is unchanged [HOME-3a ruling]', () => {
  it('sends the same input for the same choices made with the new controls', async () => {
    const { fake, form } = await loadForm()
    const sizes = within(form).getByRole('group', { name: 'Sizes' })
    await retype(field(form, 'Offer (optional)'), '2 for 1')
    await retype(field(form, 'Call to action (optional)'), 'Grab one')
    await retype(field(form, 'Tone (optional)'), 'Bright')
    await userEvent.click(within(sizes).getByRole('button', { name: '9x16 (1080×1920)' }))
    await userEvent.click(within(sizes).getByRole('button', { name: '16x9 (1920×1080)' }))
    await retype(within(sizes).getByLabelText('Other sizes'), '4:5, 1200x628')
    await userEvent.click(within(sizes).getByRole('button', { name: 'Master: 1200x628' }))
    await retype(field(form, 'Languages'), 'de, en')
    await openRules(form)
    await userEvent.type(field(form, 'Required words (de)'), 'frisch')
    await userEvent.click(within(form).getByRole('button', { name: 'en' }))
    await userEvent.type(field(form, 'Prohibited words (en)'), 'cheap{Enter}free')
    expect(await createdInput(fake)).toEqual({
      projectId: PROJECT.projectId,
      templateId: starterTemplate.id,
      brief: {
        campaignName: 'Summer Splash',
        region: 'US',
        audience: 'Adults 21 to 35',
        message: '<b>Cool</b> down with every sip',
        offer: '2 for 1',
        callToAction: 'Grab one',
        tone: 'Bright',
        subjects: [
          { id: 'citrus-can', name: 'Citrus can', description: 'A slim can' },
          { id: 'berry-bottle', name: 'Berry bottle', description: '' },
        ],
        languages: ['de', 'en'],
        sizes: ['1200x628', '1080x1080', '1920x1080', '1080x1350'],
        requiredWords: { de: ['frisch'] },
        prohibitedWords: { en: ['cheap', 'free'] },
      },
      subjectMap: [
        { subjectId: 'citrus-can', create: false },
        { subjectId: 'berry-bottle', create: false },
      ],
      languages: ['de', 'en'],
      sizes: [
        { label: '1200x628', width: 1200, height: 628 },
        { label: '1x1', width: 1080, height: 1080 },
        { label: '16x9', width: 1920, height: 1080 },
        { label: '4x5', width: 1080, height: 1350 },
      ],
      placeSubjectPhoto: false,
    })
  })
})
