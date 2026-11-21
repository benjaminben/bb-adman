import { describe, it, expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectHome } from '@/renderer/screens/project-home/project-home'
import { renderApp } from '../../render'
import { DRAFT, PROJECT, projectApi, projectGet, subject } from './project-fixture'

const NO_IDS = { ...DRAFT, subjects: [{ name: 'Citrus can' }, { name: 'Berry bottle' }] }
const MIXED = { ...DRAFT, subjects: [{ id: 'citrus-can', name: 'Citrus can' }, { name: 'Berry' }] }

type Fake = ReturnType<typeof projectApi>
const names = (fake: Fake) => fake.commands.map((c) => c.name)

async function summaryOf(fake: Fake) {
  await renderApp(<ProjectHome project={PROJECT} />, fake)
  await userEvent.click(await screen.findByRole('button', { name: 'Load a brief' }))
  return screen.findByRole('region', { name: 'Brief' })
}

function subjectItem(summary: HTMLElement, name: string): HTMLElement {
  const list = within(summary).getByRole('list', { name: 'Subjects' })
  const item = within(list)
    .getAllByRole('listitem')
    .find((li) => li.textContent?.includes(name))
  if (!item) throw new Error(`no subject ${name}`)
  return item
}

describe('subject IDs in the brief summary [SPEC 14 1.43 T-1, T-2, P1-2, P1-4]', () => {
  it('sends subject.create with each made ID, then campaign.create with the same IDs', async () => {
    const fake = projectApi(projectGet(), NO_IDS)
    await summaryOf(fake)
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
    await summaryOf(fake)
    await userEvent.click(screen.getByRole('button', { name: 'Create campaign' }))
    await waitFor(() => expect(names(fake)).toContain('campaign.create'))
    expect(names(fake)).toEqual(['brief.parse', 'subject.create', 'campaign.create'])
    expect(fake.commands[1]?.input).toMatchObject({ id: 'Berry-bottle' })
  })

  it('shows each ID, and "(made from the name)" only beside a made one', async () => {
    const summary = await summaryOf(projectApi(projectGet(), MIXED))
    const own = subjectItem(summary, 'Citrus can')
    const made = subjectItem(summary, 'Berry')
    expect(own).toHaveTextContent('citrus-can')
    expect(own).not.toHaveTextContent('(made from the name)')
    expect(made).toHaveTextContent('Berry')
    expect(made).toHaveTextContent('(made from the name)')
  })

  it('says a subject the project holds is used as it is', async () => {
    const reply = projectGet([], [subject('citrus-can', 'Citrus')])
    const summary = await summaryOf(projectApi(reply, MIXED))
    expect(subjectItem(summary, 'Citrus can')).toHaveTextContent(
      'already in this project, used as it is',
    )
    expect(subjectItem(summary, 'Berry')).not.toHaveTextContent('already in this project')
  })

  it('still names a brief ID with a space as a problem and sends nothing more', async () => {
    const draft = { ...DRAFT, subjects: [{ id: 'citrus can', name: 'Citrus can' }] }
    const fake = projectApi(projectGet(), draft)
    const summary = await summaryOf(fake)
    expect(summary).toHaveTextContent('The subject ID "citrus can" may hold only')
    expect(screen.getByRole('button', { name: 'Create campaign' })).toBeDisabled()
    expect(names(fake)).toEqual(['brief.parse'])
  })
})
