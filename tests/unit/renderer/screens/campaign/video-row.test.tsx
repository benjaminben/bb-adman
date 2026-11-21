// SPEC 14 1.57 TP-6 "While it runs": a video run's row says "Video", then "Waiting (place n)"
// or "Working, m min" from the job updates and the row's start time, with no percentage.
// Cancel and Retry are the row's own.
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CampaignView } from '@/renderer/screens/campaign/campaign-view'
import { plainMessage } from '@/shared/providers/messages'
import type { JobRow } from '@/shared/schemas/rows/job'
import { P, renderWith, sent } from './campaign-fixture'
import { videoApi, videoRow } from './video-fixture'

async function runs(jobs: JobRow[]) {
  const fake = videoApi({ jobs })
  await renderWith(<CampaignView projectId={P} campaignId="C1" onBack={() => {}} />, fake)
  return { fake, list: within(await screen.findByRole('list', { name: 'Runs' })) }
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000 - 5_000).toISOString()

afterEach(() => {
  vi.useRealTimers()
})

describe('RunRow, a video run [SPEC 14 1.57 TP-6]', () => {
  it('says "Video" and "Waiting" for a queued run', async () => {
    const { list } = await runs([videoRow()])
    expect(list.getByText('Video')).toBeInTheDocument()
    expect(list.getByText('Waiting')).toBeInTheDocument()
  })

  it('says "Waiting (place n)" while the server holds it in its queue, with no percentage', async () => {
    const row = videoRow({
      status: 'running',
      progress: 0.4,
      result: { stage: 'waiting', queuePosition: 3 },
    })
    const { list } = await runs([row])
    expect(list.getByText('Waiting (place 3)')).toBeInTheDocument()
    expect(list.queryByText(/%/)).toBeNull()
  })

  it('says "Waiting" when the server gives no place', async () => {
    const { list } = await runs([videoRow({ status: 'running', result: { stage: 'waiting' } })])
    expect(list.getByText('Waiting')).toBeInTheDocument()
  })

  it('says "Working, m min" from the row\'s start time, with no percentage', async () => {
    const row = videoRow({
      status: 'running',
      progress: 0.4,
      createdAt: minutesAgo(3),
      result: { stage: 'working' },
    })
    const { list } = await runs([row])
    expect(list.getByText('Working, 3 min')).toBeInTheDocument()
    expect(list.queryByText(/%/)).toBeNull()
  })

  it('counts up the minutes while it works', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const row = videoRow({ status: 'running', createdAt: minutesAgo(0), result: {} })
    const { list } = await runs([row])
    expect(list.getByText('Working, 0 min')).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(61_000)
    })
    expect(list.getByText('Working, 1 min')).toBeInTheDocument()
  })

  it("keeps the row's own Cancel for a running ComfyUI video", async () => {
    const { fake, list } = await runs([videoRow({ status: 'running', result: {} })])
    await userEvent.click(list.getByRole('button', { name: 'Cancel' }))
    expect(sent(fake, 'job.cancel').map((c) => c.input)).toEqual([{ projectId: P, jobId: 'J1' }])
  })

  it("keeps the row's own sentence and Retry for a failed video", async () => {
    const { fake, list } = await runs([videoRow({ status: 'failed', errorKind: 'timeout' })])
    expect(list.getByText('Video')).toBeInTheDocument()
    expect(list.getByText('Failed')).toBeInTheDocument()
    expect(list.getByText(plainMessage('timeout', 'ComfyUI'))).toBeInTheDocument()
    await userEvent.click(list.getByRole('button', { name: 'Retry' }))
    expect(sent(fake, 'job.retry').map((c) => c.input)).toEqual([{ projectId: P, jobId: 'J1' }])
  })
})
