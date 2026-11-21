import { describe, it, expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectHome } from '@/renderer/screens/project-home/project-home'
import { renderApp, axeViolations } from '../../render'
import { PROJECT, projectApi } from './project-fixture'

type Fake = ReturnType<typeof projectApi>
const names = (fake: Fake) => fake.commands.map((c) => c.name)

async function typeBrief(fake: Fake = projectApi()) {
  await renderApp(<ProjectHome project={PROJECT} />, fake)
  await userEvent.click(await screen.findByRole('button', { name: 'Type a brief' }))
  return screen.findByRole('region', { name: 'Brief' })
}

const field = (form: HTMLElement, label: string) => within(form).getByLabelText(label)

describe('"Type a brief" [screens-campaign "The brief form", S2-13]', () => {
  it('opens an empty form with one subject row and the problems listed, sending nothing', async () => {
    const fake = projectApi()
    const form = await typeBrief(fake)
    expect(field(form, 'Campaign name')).toHaveValue('')
    expect(field(form, 'Campaign name')).toHaveFocus()
    expect(within(form).getAllByRole('group', { name: /^Subject \d$/ })).toHaveLength(1)
    expect(form).toHaveTextContent('Sizes: 1x1, 9x16, 16x9')
    const list = within(form).getByRole('list', { name: 'Before the campaign can be made' })
    expect(list).toHaveTextContent('Enter the campaign name.')
    expect(list).toHaveTextContent('Give at least one language.')
    expect(screen.getByRole('button', { name: 'Create campaign' })).toBeDisabled()
    expect(fake.commands).toEqual([])
    expect(fake.queries.map((q) => q.name)).not.toContain('dialog.pickFiles')
  })

  it('fills "Languages" from the region when the user leaves "Region"', async () => {
    const form = await typeBrief()
    await userEvent.type(field(form, 'Region'), 'France')
    expect(form).not.toHaveTextContent('Languages: fr')
    await userEvent.tab()
    expect(form).toHaveTextContent('Languages: fr')
  })

  it('leaves "Languages" empty for a region not in the table', async () => {
    const form = await typeBrief()
    await userEvent.type(field(form, 'Region'), 'Atlantis')
    await userEvent.tab()
    expect(
      within(form).getByRole('list', { name: 'Before the campaign can be made' }),
    ).toHaveTextContent('Give at least one language.')
  })

  it('sends subject.create and then campaign.create for a filled form', async () => {
    const fake = projectApi()
    const form = await typeBrief(fake)
    await userEvent.type(field(form, 'Campaign name'), 'Autumn Fizz')
    await userEvent.type(field(form, 'Region'), 'Canada')
    await userEvent.type(field(form, 'Audience'), 'Students heading back to class')
    await userEvent.type(field(form, 'Message'), 'Fresh fizz for every lecture')
    const subject = within(form).getByRole('group', { name: 'Subject 1' })
    await userEvent.type(within(subject).getByLabelText('Name'), 'Apple can')
    await userEvent.type(within(subject).getByLabelText('Subject ID'), 'apple-can')
    await userEvent.click(screen.getByRole('button', { name: 'Create campaign' }))
    await waitFor(() => expect(names(fake)).toEqual(['subject.create', 'campaign.create']))
    expect(fake.commands[0]?.input).toEqual({
      projectId: 'P1',
      id: 'apple-can',
      name: 'Apple can',
      description: '',
    })
    expect(fake.commands[1]?.input).toMatchObject({
      brief: { campaignName: 'Autumn Fizz', region: 'Canada', languages: ['en'] },
      subjectMap: [{ subjectId: 'apple-can', create: false }],
      languages: ['en'],
      sizes: [{ label: '1x1' }, { label: '9x16' }, { label: '16x9' }],
    })
  })

  it('has no axe violations', async () => {
    await typeBrief()
    expect(await axeViolations()).toEqual([])
  })
})
