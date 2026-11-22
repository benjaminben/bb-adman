import { describe, it, expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectHome } from '@/renderer/screens/project-home/project-home'
import { ErrorBanner } from '@/renderer/app/error-banner'
import { renderApp, axeViolations } from '../../render'
import { DRAFT, PROJECT, projectApi, projectGet, subject } from './project-fixture'
import { addPhotos, photoStubs } from './brief-form-fixture'

const names = (fake: ReturnType<typeof projectApi>) => fake.commands.map((c) => c.name)

async function openPage(fake = projectApi()) {
  const view = await renderApp(
    <>
      <ErrorBanner />
      <ProjectHome project={PROJECT} />
    </>,
    fake,
  )
  await screen.findByText('No campaigns yet')
  return view
}

async function loadBrief() {
  await userEvent.click(screen.getByRole('button', { name: 'Load a brief' }))
  return screen.findByRole('region', { name: 'Brief' })
}

describe('Load a brief [SPEC 14 1.41 TP-1, FR-023]', () => {
  it('opens the brief picker and sends the picked path to brief.parse', async () => {
    const fake = projectApi()
    await openPage(fake)
    await loadBrief()
    expect(fake.queries).toContainEqual({ name: 'dialog.pickFiles', input: { purpose: 'brief' } })
    expect(fake.commands).toEqual([
      { name: 'brief.parse', input: { projectId: 'P1', filePath: '/b/brief.yaml' } },
    ])
  })

  it('sends nothing when the picker is cancelled', async () => {
    const fake = projectApi()
    fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: { paths: [] } }))
    await openPage(fake)
    await userEvent.click(screen.getByRole('button', { name: 'Load a brief' }))
    await waitFor(() => expect(fake.queries.map((q) => q.name)).toContain('dialog.pickFiles'))
    expect(fake.commands).toEqual([])
    expect(screen.queryByRole('region', { name: 'Brief' })).toBeNull()
  })

  it("shows the brief's message word for word, as text", async () => {
    await openPage()
    const summary = await loadBrief()
    expect(within(summary).getByText(DRAFT.message ?? '')).toBeInTheDocument()
    expect(summary.querySelector('b')).toBeNull()
  })

  it('shows the name, audience, region, subjects, sizes and languages', async () => {
    await openPage()
    const summary = await loadBrief()
    const fields: [string, string][] = [
      ['Campaign name', 'Summer Splash'],
      ['Audience', 'Adults 21 to 35'],
      ['Region', 'US'],
    ]
    for (const [label, value] of fields) {
      expect(within(summary).getByLabelText(label)).toHaveValue(value)
    }
    const subjects = within(summary).getByRole('list', { name: 'Subjects' })
    expect(
      within(subjects)
        .getAllByLabelText('Name')
        .map((f) => (f as HTMLInputElement).value),
    ).toEqual(['Citrus can', 'Berry bottle'])
    expect(within(summary).getByLabelText('1x1 (1080×1080)')).toBeChecked()
    expect(within(summary).getByLabelText('9x16 (1080×1920)')).toBeChecked()
    expect(within(summary).getByLabelText('Languages')).toHaveValue('en, de')
  })

  it('sends one subject.create per subject and then one campaign.create', async () => {
    const fake = photoStubs(projectApi())
    await openPage(fake)
    await addPhotos(await loadBrief())
    await userEvent.click(screen.getByRole('button', { name: 'Create campaign' }))
    await waitFor(() => expect(names(fake)).toContain('campaign.create'))
    expect(names(fake)).toEqual([
      'brief.parse',
      'asset.import',
      'asset.import',
      'subject.create',
      'subject.create',
      'asset.update',
      'asset.update',
      'campaign.create',
    ])
    expect(fake.commands[3]?.input).toEqual({
      projectId: 'P1',
      id: 'citrus-can',
      name: 'Citrus can',
      description: 'A slim can',
    })
    expect(fake.commands[7]?.input).toMatchObject({
      projectId: 'P1',
      languages: ['en', 'de'],
      templateId: 'starter',
      subjectMap: [
        { subjectId: 'citrus-can', create: false },
        { subjectId: 'berry-bottle', create: false },
      ],
    })
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Brief' })).toBeNull())
  })

  it('does not create a subject the project already holds', async () => {
    const fake = photoStubs(projectApi(projectGet([], [subject('citrus-can', 'Citrus can')])))
    await openPage(fake)
    await addPhotos(await loadBrief())
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
  })

  it('sends neither on Cancel and drops the summary', async () => {
    const fake = projectApi()
    await openPage(fake)
    await loadBrief()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('region', { name: 'Brief' })).toBeNull()
    expect(names(fake)).toEqual(['brief.parse'])
  })

  it("creates nothing for a refused brief and shows the command's message", async () => {
    const fake = projectApi()
    const message =
      'The brief is malformed. The first line that could not be read is line 3: "a: ["'
    fake.onCommand('brief.parse', () => ({
      ok: false,
      error: { code: 'INVALID_INPUT', message, details: { reason: 'brief_malformed', line: 3 } },
    }))
    await openPage(fake)
    await userEvent.click(screen.getByRole('button', { name: 'Load a brief' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.queryByRole('region', { name: 'Brief' })).toBeNull()
    expect(names(fake)).toEqual(['brief.parse'])
  })

  it('stops before campaign.create when a subject.create is refused', async () => {
    const fake = photoStubs(projectApi())
    fake.onCommand('subject.create', () => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message: 'That subject ID is taken.' },
    }))
    await openPage(fake)
    await addPhotos(await loadBrief())
    await userEvent.click(screen.getByRole('button', { name: 'Create campaign' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That subject ID is taken.')
    expect(names(fake)).toEqual(['brief.parse', 'asset.import', 'asset.import', 'subject.create'])
    expect(screen.getByRole('region', { name: 'Brief' })).toBeInTheDocument()
  })

  it('shows the ID made from the name for a subject with no ID', async () => {
    const fake = photoStubs(
      projectApi(projectGet(), { ...DRAFT, subjects: [{ name: 'Citrus can' }] }),
    )
    await openPage(fake)
    const summary = await loadBrief()
    await addPhotos(summary)
    expect(within(summary).getByLabelText('Subject ID')).toHaveValue('Citrus-can')
    expect(screen.getByRole('button', { name: 'Create campaign' })).toBeEnabled()
    expect(names(fake)).toEqual(['brief.parse', 'asset.import'])
  })

  it('disables its buttons while the campaign is being created', async () => {
    const fake = photoStubs(projectApi())
    fake.onCommand('campaign.create', () => new Promise(() => {}))
    await openPage(fake)
    await addPhotos(await loadBrief())
    await userEvent.click(screen.getByRole('button', { name: 'Create campaign' }))
    expect(await screen.findByText('Creating the campaign…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create campaign' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('has no axe violations with the summary shown', async () => {
    await openPage()
    await loadBrief()
    expect(await axeViolations()).toEqual([])
  })
})
