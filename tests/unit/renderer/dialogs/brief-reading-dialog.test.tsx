// P4-15 (spec/screens-ai.md, "Reading a brief with AI"; "Attached jobs and the close warning"):
// the reading dialog follows its brief_extraction job. Stop cancels it; closing it another way
// while the job runs warns first.
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BriefReadingDialog } from '@/renderer/dialogs/brief-reading-dialog'
import { attachedStoreFor, dialogJobs } from '@/renderer/stores/attached-store'
import type { JobRow } from '@/shared/schemas/rows/job'
import { axeViolations, renderApp } from '../render'
import { makeFakeApi } from '../fake-api'
import { jobRow } from '../stores/job-fixture'

const DRAFT = { campaignName: 'Harbour Lights', languages: ['en'] }

const row = (over: Partial<JobRow> = {}) =>
  jobRow('J1', {
    kind: 'brief_extraction',
    status: 'running',
    campaignId: null,
    variantId: null,
    slot: null,
    provider: 'gemini',
    request: { text: 'Campaign name: Harbour Lights' },
    ...over,
  })

async function draw(fake = makeFakeApi()) {
  const calls = { onRead: vi.fn(), onTryAgain: vi.fn(), onByHand: vi.fn(), onClosed: vi.fn() }
  const view = await renderApp(
    <main>
      <h1>Summer</h1>
      <BriefReadingDialog projectId="P1" jobId="J1" provider="gemini" {...calls} />
    </main>,
    fake,
  )
  await screen.findByRole('dialog', { name: 'Reading the brief' })
  act(() => fake.emit('job.updated', row()))
  return { ...view, ...calls, fake }
}

const sent = (fake: ReturnType<typeof makeFakeApi>, name: string) =>
  fake.commands.filter((c) => c.name === name).map((c) => c.input)

describe('BriefReadingDialog [P4-15]', () => {
  it('says which provider is reading and holds the job under the dialog', async () => {
    const { fake } = await draw()
    expect(screen.getByText('Google Gemini is reading the brief…')).toBeInTheDocument()
    const held = dialogJobs(attachedStoreFor(fake.api).getState(), 'brief-reading-J1')
    expect(held.map((j) => j.jobId)).toEqual(['J1'])
  })

  it('Stop sends job.cancel and closes', async () => {
    const { fake, onClosed } = await draw()
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(sent(fake, 'job.cancel')).toEqual([{ projectId: 'P1', jobId: 'J1' }])
    expect(onClosed).toHaveBeenCalledOnce()
    expect(attachedStoreFor(fake.api).getState().jobs).toEqual([])
  })

  it('warns before Escape closes it while the job runs', async () => {
    const { fake, onClosed } = await draw()
    await userEvent.keyboard('{Escape}')
    const warning = await screen.findByRole('dialog', { name: 'Stop reading the brief?' })
    expect(warning).toHaveTextContent('Reading the brief is still running.')
    expect(warning).toHaveTextContent('A request already sent may still be charged.')
    await userEvent.click(screen.getByRole('button', { name: 'Keep open' }))
    expect(onClosed).not.toHaveBeenCalled()
    expect(sent(fake, 'job.cancel')).toEqual([])

    await userEvent.keyboard('{Escape}')
    await userEvent.click(await screen.findByRole('button', { name: 'Stop and close' }))
    expect(sent(fake, 'job.cancel')).toEqual([{ projectId: 'P1', jobId: 'J1' }])
    expect(onClosed).toHaveBeenCalledOnce()
  })

  it('on success sends job.markSeen and hands over the draft', async () => {
    const { fake, onRead } = await draw()
    const result = { draft: DRAFT, primaryLanguage: 'en' }
    act(() => fake.emit('job.updated', row({ status: 'succeeded', result })))
    expect(onRead).toHaveBeenCalledWith(result)
    expect(sent(fake, 'job.markSeen')).toEqual([{ projectId: 'P1', jobIds: ['J1'] }])
  })

  it('reads a job that ended before the dialog followed it', async () => {
    const fake = makeFakeApi()
    const result = { draft: DRAFT, primaryLanguage: 'en' }
    fake.onQuery('job.get', () => ({ ok: true, data: row({ status: 'succeeded', result }) }))
    const { onRead } = await draw(fake)
    expect(onRead).toHaveBeenCalledWith(result)
    expect(fake.queries).toContainEqual({
      name: 'job.get',
      input: { projectId: 'P1', jobId: 'J1' },
    })
  })

  it('on failure shows the sentence, Try again and Fill the form by hand', async () => {
    const { fake, onTryAgain, onByHand, onClosed } = await draw()
    act(() => fake.emit('job.updated', row({ status: 'failed', errorKind: 'timeout' })))
    expect(screen.getByText('Google Gemini took too long to answer. Try again.')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onTryAgain).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('button', { name: 'Fill the form by hand' }))
    expect(onByHand).toHaveBeenCalledOnce()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: /^Stop/ })).toBeNull()
    expect(onClosed).toHaveBeenCalledOnce()
  })

  it('closes when the job is cancelled elsewhere', async () => {
    const { fake, onClosed, onRead } = await draw()
    act(() => fake.emit('job.updated', row({ status: 'cancelled' })))
    expect(onClosed).toHaveBeenCalledOnce()
    expect(onRead).not.toHaveBeenCalled()
  })

  it('shows a succeeded answer that is not a brief draft as a failure', async () => {
    const { fake, onRead } = await draw()
    act(() => fake.emit('job.updated', row({ status: 'succeeded', result: { draft: 3 } })))
    expect(onRead).not.toHaveBeenCalled()
    expect(
      screen.getByText('Google Gemini could not finish this request. Try again.'),
    ).toBeVisible()
    expect(sent(fake, 'job.markSeen')).toEqual([])
  })

  it('has no axe violations while reading and after a failure', async () => {
    const { fake } = await draw()
    expect(await axeViolations()).toEqual([])
    act(() => fake.emit('job.updated', row({ status: 'failed', errorKind: 'other' })))
    expect(await axeViolations()).toEqual([])
  })
})
