import { describe, it, expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectHome } from '@/renderer/screens/project-home/project-home'
import { renderApp } from '../../render'
import { DRAFT, PROJECT, projectApi, projectGet, subject } from './project-fixture'
import { addPhotos, photoStubs } from './brief-form-fixture'

const NO_IDS = { ...DRAFT, subjects: [{ name: 'Citrus can' }, { name: 'Berry bottle' }] }
const MIXED = { ...DRAFT, subjects: [{ id: 'citrus-can', name: 'Citrus can' }, { name: 'Berry' }] }

type Fake = ReturnType<typeof projectApi>
const names = (fake: Fake) => fake.commands.map((c) => c.name)

async function summaryOf(fake: Fake) {
  await renderApp(<ProjectHome project={PROJECT} />, photoStubs(fake))
  await userEvent.click(await screen.findByRole('button', { name: 'Load a brief' }))
  return screen.findByRole('region', { name: 'New campaign' })
}

function subjectItem(summary: HTMLElement, name: string): HTMLElement {
  const list = within(summary).getByRole('list', { name: 'Subjects' })
  const item = within(list)
    .getAllByRole('listitem')
    .filter((li) => li.parentElement === list)
    .find((li) => (within(li).getByLabelText('Name') as HTMLInputElement).value === name)
  if (!item) throw new Error(`no subject ${name}`)
  return item
}

describe('subject IDs in the brief summary [SPEC 14 1.43 T-1, T-2, P1-2, P1-4]', () => {
  it('sends subject.create with each made ID, then campaign.create with the same IDs', async () => {
    const fake = projectApi(projectGet(), NO_IDS)
    await addPhotos(await summaryOf(fake))
    await userEvent.click(screen.getByRole('button', { name: 'Create campaign' }))
    await waitFor(() => expect(names(fake)).toContain('campaign.create'))
    expect(fake.commands.filter((c) => c.name === 'subject.create').map((c) => c.input)).toEqual([
      { projectId: 'P1', id: 'Citrus-can', name: 'Citrus can', description: '' },
      { projectId: 'P1', id: 'Berry-bottle', name: 'Berry bottle', description: '' },
    ])
    expect(fake.commands.at(-1)?.input).toMatchObject({
      subjectMap: [
        { subjectId: 'Citrus-can', create: false },
        { subjectId: 'Berry-bottle', create: false },
      ],
    })
  })

  it('sends no subject.create for a made ID the project holds', async () => {
    const fake = projectApi(projectGet([], [subject('Citrus-can', 'Citrus can')]), NO_IDS)
    await addPhotos(await summaryOf(fake))
    await userEvent.click(screen.getByRole('button', { name: 'Create campaign' }))
    await waitFor(() => expect(names(fake)).toContain('campaign.create'))
    expect(names(fake)).toEqual([
      'brief.parse',
      'asset.import',
      'asset.import',
      'subject.create',
      'asset.update',
      'asset.update',
      'campaign.create',
    ])
    expect(fake.commands[3]?.input).toMatchObject({ id: 'Berry-bottle' })
  })

  it('shows each ID in its "Subject ID" field, one made from the name when the brief has none', async () => {
    const summary = await summaryOf(
      projectApi(projectGet(), {
        ...MIXED,
        subjects: [{ id: 'citrus-can', name: 'Citrus can' }, { name: 'Berry bottle' }],
      }),
    )
    const own = subjectItem(summary, 'Citrus can')
    const made = subjectItem(summary, 'Berry bottle')
    expect(within(own).getByLabelText('Subject ID')).toHaveValue('citrus-can')
    expect(within(made).getByLabelText('Subject ID')).toHaveValue('Berry-bottle')
  })

  it('chooses "Use a subject this project has" for a subject the project holds', async () => {
    const reply = projectGet([], [subject('citrus-can', 'Citrus')])
    const summary = await summaryOf(projectApi(reply, MIXED))
    const held = subjectItem(summary, 'Citrus can')
    expect(within(held).getByLabelText('Use a subject this project has')).toBeChecked()
    expect(within(held).getByLabelText('Project subject')).toHaveValue('citrus-can')
    expect(within(subjectItem(summary, 'Berry')).getByLabelText('New subject')).toBeChecked()
  })

  it('still names a brief ID with a space as a problem and sends nothing more', async () => {
    const draft = { ...DRAFT, subjects: [{ id: 'citrus can', name: 'Citrus can' }] }
    const fake = projectApi(projectGet(), draft)
    const summary = await summaryOf(fake)
    expect(summary).toHaveTextContent('Subject 1: the ID "citrus can" may hold only')
    expect(screen.getByRole('button', { name: 'Create campaign' })).toBeDisabled()
    expect(names(fake)).toEqual(['brief.parse'])
  })
})
