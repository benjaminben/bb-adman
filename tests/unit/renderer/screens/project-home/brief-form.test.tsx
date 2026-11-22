import { describe, it, expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectHome } from '@/renderer/screens/project-home/project-home'
import { renderApp, axeViolations } from '../../render'
import { DRAFT, PROJECT, projectApi, projectGet, subject } from './project-fixture'
import { addPhotos, photoStubs } from './brief-form-fixture'

type Fake = ReturnType<typeof projectApi>
const names = (fake: Fake) => fake.commands.map((c) => c.name)
const sent = (fake: Fake, name: string) => fake.commands.find((c) => c.name === name)?.input

async function openForm(fake: Fake = projectApi()) {
  await renderApp(<ProjectHome project={PROJECT} />, photoStubs(fake))
  await userEvent.click(await screen.findByRole('button', { name: 'Load a brief' }))
  return screen.findByRole('region', { name: 'New campaign' })
}

const row = (form: HTMLElement, n: number) =>
  within(form).getByRole('group', { name: `Subject ${n}` })

async function create(fake: Fake) {
  await userEvent.click(screen.getByRole('button', { name: 'Create campaign' }))
  await waitFor(() => expect(names(fake)).toContain('campaign.create'))
}

describe('the brief form [screens-campaign "The brief form", FR-023, FR-024]', () => {
  it('puts focus on "Campaign name" when it opens', async () => {
    const form = await openForm()
    expect(within(form).getByLabelText('Campaign name')).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Load a brief' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Type a brief' })).toBeNull()
  })

  it('shows the message word for word and sends what the user typed', async () => {
    const fake = projectApi()
    const form = await openForm(fake)
    await addPhotos(form)
    expect(within(form).getByLabelText('Message')).toHaveValue(DRAFT.message)
    await userEvent.clear(within(form).getByLabelText('Campaign name'))
    await userEvent.type(within(form).getByLabelText('Campaign name'), 'Autumn Fizz')
    await userEvent.type(within(form).getByLabelText('Tone (optional)'), 'Warm')
    await userEvent.clear(within(row(form, 1)).getByLabelText('Name'))
    await userEvent.type(within(row(form, 1)).getByLabelText('Name'), 'Lime can')
    await create(fake)
    expect(sent(fake, 'campaign.create')).toMatchObject({
      brief: { campaignName: 'Autumn Fizz', tone: 'Warm', message: DRAFT.message },
    })
    expect(sent(fake, 'subject.create')).toMatchObject({ id: 'citrus-can', name: 'Lime can' })
  })

  it('sends a typed Subject ID for a new subject', async () => {
    const fake = projectApi()
    const form = await openForm(fake)
    await addPhotos(form)
    const id = within(row(form, 2)).getByLabelText('Subject ID')
    await userEvent.clear(id)
    await userEvent.type(id, 'berry-500ml')
    await create(fake)
    expect(fake.commands.filter((c) => c.name === 'subject.create')[1]?.input).toMatchObject({
      id: 'berry-500ml',
    })
  })

  it('uses a chosen subject of the project and sends no subject.create for it', async () => {
    const fake = projectApi(projectGet([], [subject('lime-can', 'Lime can')]))
    const form = await openForm(fake)
    await addPhotos(form)
    const first = row(form, 1)
    await userEvent.click(within(first).getByLabelText('Use a subject this project has'))
    await userEvent.selectOptions(within(first).getByLabelText('Project subject'), 'lime-can')
    expect(within(first).queryByLabelText('Subject ID')).toBeNull()
    await create(fake)
    expect(names(fake)).toEqual([
      'brief.parse',
      'asset.import',
      'asset.import',
      'subject.create',
      'asset.update',
      'asset.update',
      'campaign.create',
    ])
    expect(sent(fake, 'campaign.create')).toMatchObject({
      subjectMap: [{ subjectId: 'lime-can' }, { subjectId: 'berry-bottle' }],
    })
  })

  it('adds a row with focus on its Name, and Remove puts focus on "Add subject"', async () => {
    const form = await openForm()
    const add = within(form).getByRole('button', { name: 'Add subject' })
    await userEvent.click(add)
    expect(within(row(form, 3)).getByLabelText('Name')).toHaveFocus()
    expect(within(row(form, 3)).getByLabelText('New subject')).toBeChecked()
    await userEvent.click(within(form).getByRole('button', { name: 'Remove subject 1' }))
    expect(add).toHaveFocus()
    expect(within(form).getAllByRole('group', { name: /^Subject \d$/ })).toHaveLength(2)
    expect(within(row(form, 1)).getByLabelText('Name')).toHaveValue('Berry bottle')
    await userEvent.click(within(form).getByRole('button', { name: 'Remove subject 2' }))
    expect(within(form).getByRole('button', { name: 'Remove subject 1' })).toBeDisabled()
  })

  it('creates nothing on Enter in a field', async () => {
    const fake = projectApi()
    const form = await openForm(fake)
    await userEvent.type(within(form).getByLabelText('Campaign name'), '{Enter}')
    await userEvent.type(within(row(form, 1)).getByLabelText('Subject ID'), '{Enter}')
    expect(names(fake)).toEqual(['brief.parse'])
  })

  it('lists the problems and keeps "Create campaign" disabled', async () => {
    const form = await openForm(projectApi(projectGet(), { ...DRAFT, audience: undefined }))
    await addPhotos(form)
    const list = within(form).getByRole('list', { name: 'To fix' })
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Enter the audience.'])
    expect(screen.getByRole('button', { name: 'Create campaign' })).toBeDisabled()
  })

  it('disables every field and button while creating', async () => {
    const fake = projectApi()
    fake.onCommand('campaign.create', () => new Promise(() => {}))
    const form = await openForm(fake)
    await addPhotos(form)
    await create(fake)
    expect(await within(form).findByText('Creating the campaign…')).toBeInTheDocument()
    for (const control of [
      ...within(form).getAllByRole('textbox'),
      ...within(form).getAllByRole('button'),
      ...within(form).getAllByRole('radio'),
    ]) {
      expect(control).toBeDisabled()
    }
  })

  it('opens the new campaign once it is made [A-45]', async () => {
    const fake = projectApi()
    fake.onCommand('campaign.create', () => ({ ok: true, data: { campaignId: 'C7' } }))
    await addPhotos(await openForm(fake))
    await create(fake)
    expect(await screen.findByRole('region', { name: 'Campaign' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'New campaign' })).toBeNull()
  })

  it('has no axe violations', async () => {
    await openForm(projectApi(projectGet([], [subject('lime-can', 'Lime can')])))
    expect(await axeViolations()).toEqual([])
  })
})
