// P4-15 (spec/screens-ai.md, "Reading a brief with AI"; FR-022, FR-171): a Markdown or text
// brief goes through the run dialog to brief.extract; its job fills the brief form. Security
// (spec/security.md, "Paths in the renderer"): the only path sent is the brief picker's.
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ProjectHome } from '@/renderer/screens/project-home/project-home'
import { ErrorBanner } from '@/renderer/app/error-banner'
import type { JobRow } from '@/shared/schemas/rows/job'
import { renderApp } from '../../render'
import { jobRow } from '../../stores/job-fixture'
import { PROJECT, projectApi } from './project-fixture'

const PICKED = '/Users/me/Briefs/Harbour Lights.MD'
const RESULT = {
  draft: { campaignName: 'Harbour Lights', region: 'CA', languages: ['fr'] },
  primaryLanguage: 'fr',
}

type Fake = ReturnType<typeof projectApi>
const names = (fake: Fake) => fake.commands.map((c) => c.name)
const sent = (fake: Fake, name: string) =>
  fake.commands.filter((c) => c.name === name).map((c) => c.input)

const row = (over: Partial<JobRow>) =>
  jobRow('J1', {
    kind: 'brief_extraction',
    status: 'running',
    campaignId: null,
    variantId: null,
    slot: null,
    provider: 'gemini',
    ...over,
  })

function textApi(path = PICKED) {
  const fake = projectApi()
  fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: { paths: [path] } }))
  fake.onCommand('brief.extract', () => ({ ok: true, data: { jobId: 'J1' } }))
  return fake
}

async function openPage(fake: Fake) {
  const view = await renderApp(
    <>
      <ErrorBanner />
      <ProjectHome project={PROJECT} />
    </>,
    fake,
  )
  await screen.findByText('No campaign yet.')
  return view
}

async function confirmRead() {
  await userEvent.click(screen.getByRole('button', { name: 'Load a brief' }))
  const run = await screen.findByRole('dialog', { name: 'Read the brief with AI' })
  await userEvent.click(within(run).getByRole('button', { name: 'Read brief' }))
}

async function startReading(fake: Fake) {
  await openPage(fake)
  await confirmRead()
  await screen.findByRole('dialog', { name: 'Reading the brief' })
  act(() => fake.emit('job.updated', row({})))
}

describe('Load a brief: Markdown and text [P4-15]', () => {
  it('still sends a .json brief to brief.parse', async () => {
    const fake = textApi('/b/brief.json')
    await openPage(fake)
    await userEvent.click(screen.getByRole('button', { name: 'Load a brief' }))
    await screen.findByRole('region', { name: 'Brief' })
    expect(names(fake)).toEqual(['brief.parse'])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it.each(['/b/brief.md', '/b/brief.TXT', '/b/brief.markdown'])(
    'opens the run dialog for %s and sends nothing on Cancel',
    async (path) => {
      const fake = textApi(path)
      await openPage(fake)
      await userEvent.click(screen.getByRole('button', { name: 'Load a brief' }))
      const run = await screen.findByRole('dialog', { name: 'Read the brief with AI' })
      expect(within(run).getByText('This sends 1 paid request to Google Gemini.')).toBeVisible()
      await userEvent.click(within(run).getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(fake.commands).toEqual([])
    },
  )

  it("sends brief.extract with exactly the picker's path on Read brief", async () => {
    const fake = textApi()
    await openPage(fake)
    await confirmRead()
    await screen.findByRole('dialog', { name: 'Reading the brief' })
    expect(fake.commands).toEqual([
      { name: 'brief.extract', input: { projectId: 'P1', filePath: PICKED, provider: 'gemini' } },
    ])
    expect(screen.queryByRole('dialog', { name: 'Read the brief with AI' })).toBeNull()
  })

  it('opens the brief form filled on success and sends job.markSeen', async () => {
    const fake = textApi()
    await startReading(fake)
    act(() => fake.emit('job.updated', row({ status: 'succeeded', result: RESULT })))
    const form = await screen.findByRole('region', { name: 'Brief' })
    expect(within(form).getByLabelText('Campaign name')).toHaveValue('Harbour Lights')
    expect(within(form).getByLabelText('Region')).toHaveValue('CA')
    expect(within(form).getByLabelText('Languages')).toHaveValue('fr')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(sent(fake, 'job.markSeen')).toEqual([{ projectId: 'P1', jobIds: ['J1'] }])
  })

  it('on failure offers Try again, which sends the same path again', async () => {
    const fake = textApi()
    await startReading(fake)
    act(() => fake.emit('job.updated', row({ status: 'failed', errorKind: 'offline' })))
    expect(
      await screen.findByText(
        'The app could not reach Google Gemini. Check your internet connection and try again.',
      ),
    ).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    const run = await screen.findByRole('dialog', { name: 'Read the brief with AI' })
    fake.onCommand('brief.extract', () => ({ ok: true, data: { jobId: 'J2' } }))
    await userEvent.click(within(run).getByRole('button', { name: 'Read brief' }))
    await screen.findByRole('dialog', { name: 'Reading the brief' })
    expect(sent(fake, 'brief.extract')).toEqual([
      { projectId: 'P1', filePath: PICKED, provider: 'gemini' },
      { projectId: 'P1', filePath: PICKED, provider: 'gemini' },
    ])
  })

  it('on failure, Fill the form by hand opens the empty form', async () => {
    const fake = textApi()
    await startReading(fake)
    act(() => fake.emit('job.updated', row({ status: 'failed', errorKind: 'other' })))
    await userEvent.click(await screen.findByRole('button', { name: 'Fill the form by hand' }))
    const form = await screen.findByRole('region', { name: 'Brief' })
    expect(within(form).getByLabelText('Campaign name')).toHaveValue('')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the empty form when the key dialog is cancelled', async () => {
    const fake = textApi()
    fake.onCommand('brief.extract', () => ({
      ok: false,
      error: { code: 'NEEDS_KEY', message: 'Add a key.', details: { provider: 'gemini' } },
    }))
    const { store } = await openPage(fake)
    await userEvent.click(screen.getByRole('button', { name: 'Load a brief' }))
    const run = await screen.findByRole('dialog', { name: 'Read the brief with AI' })
    await userEvent.click(within(run).getByRole('button', { name: 'Read brief' }))
    await waitFor(() => expect(store.getState().keyRequest).not.toBeNull())
    act(() => store.getState().keyRequest?.resolve(false))
    const form = await screen.findByRole('region', { name: 'Brief' })
    expect(within(form).getByLabelText('Campaign name')).toHaveValue('')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(names(fake)).toEqual(['brief.extract'])
  })

  it('keeps the run dialog open with the refusal for any other refusal', async () => {
    const fake = textApi()
    fake.onCommand('brief.extract', () => ({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'That file was not found.' },
    }))
    await openPage(fake)
    await confirmRead()
    const run = screen.getByRole('dialog', { name: 'Read the brief with AI' })
    expect(await within(run).findByText('That file was not found.')).toBeVisible()
    expect(screen.queryByRole('region', { name: 'Brief' })).toBeNull()
  })
})
