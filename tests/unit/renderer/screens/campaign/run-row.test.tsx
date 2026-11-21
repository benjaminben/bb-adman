// SPEC 14 1.41 TP-2 "A run's row, by status": what each status draws, Cancel and Retry.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CampaignView } from '@/renderer/screens/campaign/campaign-view'
import { ErrorBanner } from '@/renderer/app/error-banner'
import { plainMessage } from '@/shared/providers/messages'
import type { JobRow } from '@/shared/schemas/rows/job'
import { baseState } from '../../fake-api'
import { jobRow } from '../../stores/job-fixture'
import { LOCAL, P, campaignApi, renderWith, sent } from './campaign-fixture'

const view = (
  <>
    <CampaignView projectId={P} campaignId="C1" onBack={() => {}} />
    <ErrorBanner />
  </>
)

async function runs(jobs: JobRow[], fake = campaignApi({ jobs })) {
  await renderWith(view, fake)
  return { fake, list: within(await screen.findByRole('list', { name: 'Runs' })) }
}

const withLocal = () => ({ providers: [LOCAL, ...baseState().providers] })

describe('RunRow [SPEC 14 1.41 TP-2]', () => {
  it('shows "No runs yet." with no run', async () => {
    await renderWith(view)
    expect(await screen.findByText('No runs yet.')).toBeInTheDocument()
  })

  it('draws a queued run as Waiting', async () => {
    const { list } = await runs([jobRow('J1')])
    expect(list.getByText('Waiting')).toBeInTheDocument()
  })

  it('draws a running run as Working, with the stage, the place in the queue and the percent', async () => {
    const row = jobRow('J1', {
      status: 'running',
      progress: 0.4,
      result: { stage: 'waiting', queuePosition: 3 },
    })
    const { list } = await runs([row])
    expect(list.getByText('Working')).toBeInTheDocument()
    expect(list.getByText('waiting · place in queue 3 · 40%')).toBeInTheDocument()
  })

  it('draws a failed run with the bad_key sentence and Retry', async () => {
    const { list } = await runs([jobRow('J1', { status: 'failed', errorKind: 'bad_key' })])
    expect(list.getByText(plainMessage('bad_key', 'Google Gemini'))).toBeInTheDocument()
    expect(list.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('draws a failed run with no kind with the "other" sentence', async () => {
    const { list } = await runs([jobRow('J1', { status: 'failed' })])
    expect(list.getByText(plainMessage('other', 'Google Gemini'))).toBeInTheDocument()
  })

  it('draws a cancelled run as Cancelled, with Retry', async () => {
    const { list } = await runs([jobRow('J1', { status: 'cancelled' })])
    expect(list.getByText('Cancelled')).toBeInTheDocument()
    expect(list.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it("asks first on Retry of a paid provider's run, then sends job.retry", async () => {
    const { fake, list } = await runs([jobRow('J1', { status: 'failed' })])
    await userEvent.click(list.getByRole('button', { name: 'Retry' }))
    expect(list.getByText('This sends 2 paid request(s) to Google Gemini.')).toBeInTheDocument()
    expect(sent(fake, 'job.retry')).toEqual([])
    await userEvent.click(list.getByRole('button', { name: 'Confirm' }))
    expect(sent(fake, 'job.retry').map((c) => c.input)).toEqual([{ projectId: P, jobId: 'J1' }])
  })

  it("retries a local provider's run without asking", async () => {
    const row = jobRow('J1', { status: 'cancelled', provider: 'fake' })
    const { fake, list } = await runs([row], campaignApi({ jobs: [row], state: withLocal() }))
    await userEvent.click(list.getByRole('button', { name: 'Retry' }))
    expect(sent(fake, 'job.retry')).toHaveLength(1)
  })

  it('shows no Cancel for a provider that cannot cancel', async () => {
    const { list } = await runs([jobRow('J1', { status: 'running', kind: 'video_generation' })])
    expect(list.queryByRole('button', { name: 'Cancel' })).toBeNull()
  })

  it('sends job.cancel for a queued run of a provider that can cancel', async () => {
    const row = jobRow('J1', { provider: 'fake' })
    const { fake, list } = await runs([row], campaignApi({ jobs: [row], state: withLocal() }))
    await userEvent.click(list.getByRole('button', { name: 'Cancel' }))
    expect(sent(fake, 'job.cancel').map((c) => c.input)).toEqual([{ projectId: P, jobId: 'J1' }])
  })

  it("shows a refused cancel's message", async () => {
    const row = jobRow('J1', { status: 'running', provider: 'fake' })
    const fake = campaignApi({ jobs: [row], state: withLocal() })
    fake.onCommand('job.cancel', () => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message: 'Stand-in cannot stop a request once it is sent.' },
    }))
    const { list } = await runs([row], fake)
    await userEvent.click(list.getByRole('button', { name: 'Cancel' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Stand-in cannot stop a request once it is sent.',
    )
  })

  it('shows the run a Retry started once its row arrives', async () => {
    const row = jobRow('J1', { status: 'cancelled', provider: 'fake' })
    const fake = campaignApi({ jobs: [row], state: withLocal() })
    fake.onCommand('job.retry', () => ({ ok: true, data: { jobId: 'J2' } }))
    const { list } = await runs([row], fake)
    await userEvent.click(list.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(sent(fake, 'job.retry')).toHaveLength(1))
    fake.emit('job.updated', jobRow('J2', { createdAt: '2026-11-21T02:00:00.000Z' }))
    expect(await list.findByText('Waiting')).toBeInTheDocument()
    expect(fake.queries.filter((q) => q.name === 'job.list')).toHaveLength(1)
  })

  // spec/cancel.md "job.cancel": Cancel shows exactly when job.cancel would accept it.
  it.each([
    ['queued', 'image_generation', 'gemini', true],
    ['queued', 'video_generation', 'gemini', true],
    ['queued', 'image_generation', 'fake', true],
    ['running', 'image_generation', 'gemini', true],
    ['running', 'video_generation', 'gemini', false],
    ['running', 'image_generation', 'fake', true],
    ['running', 'video_generation', 'fake', true],
    ['succeeded', 'image_generation', 'fake', false],
  ] as const)('a %s %s run on %s shows Cancel: %s', async (status, kind, provider, shown) => {
    const row = jobRow('J1', { status, kind, provider })
    const { list } = await runs([row], campaignApi({ jobs: [row], state: withLocal() }))
    expect(list.queryByRole('button', { name: 'Cancel' }) !== null).toBe(shown)
  })

  // spec/agent-runs.md "Settings block", item 5: the mark under the kind.
  it.each([
    ['agent', 'image_generation', true],
    ['agent', 'video_generation', true],
    ['user', 'image_generation', false],
    ['user', 'video_generation', false],
  ] as const)('a run started by %s (%s) shows the agent mark: %s', async (by, kind, shown) => {
    const { list } = await runs([jobRow('J1', { startedBy: by, kind })])
    expect(list.queryByText('Started by an agent') !== null).toBe(shown)
  })
})
