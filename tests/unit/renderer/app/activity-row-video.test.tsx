// An activity row for a run (spec/screens-ai.md, "The activity panel"; design wave CAMP-7):
// the words the campaign page's run rows had, word for word. A video run (SPEC 14 1.57 TP-6
// "While it runs") says "Video", then "Waiting (place n)" or "Working, m min" from the row's
// start time, with no percentage, counting up while it works; its Cancel and Retry are the
// row's own. A picture run shows the stage, the place in the queue and the percent.
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActivityRow } from '@/renderer/app/activity-row'
import { plainMessage } from '@/shared/providers/messages'
import type { JobRow } from '@/shared/schemas/rows/job'
import { baseState, makeFakeApi } from '../fake-api'
import { renderApp } from '../render'
import { COMFY, videoRow } from '../screens/campaign/video-fixture'
import { jobRow } from '../stores/job-fixture'

const PLACE = { campaignName: 'Spring', variantLabel: 'Hero · 1:1 · en', layerName: null }

async function draw(job: JobRow) {
  const fake = makeFakeApi(baseState({ providers: [...baseState().providers, COMFY] }))
  fake.onCommand('job.retry', () => ({ ok: true, data: { jobId: 'J2' } }))
  await renderApp(
    <main>
      <ul aria-label="Jobs">
        <ActivityRow entry={{ job, place: PLACE }} projectId="P1" onGo={() => {}} />
      </ul>
    </main>,
    fake,
  )
  const sent = (name: string) => fake.commands.filter((c) => c.name === name)
  return { sent, row: within(screen.getByRole('listitem')) }
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000 - 5_000).toISOString()

afterEach(() => {
  vi.useRealTimers()
})

describe('ActivityRow, a video run [SPEC 14 1.57 TP-6]', () => {
  it('says "Video" and "Waiting" for a queued run', async () => {
    const { row } = await draw(videoRow())
    expect(row.getByText(/^Video · ComfyUI$/)).toBeInTheDocument()
    expect(row.getByText('Waiting')).toBeInTheDocument()
  })

  it('says "Waiting (place n)" while the server holds it in its queue, with no percentage', async () => {
    const job = videoRow({
      status: 'running',
      progress: 0.4,
      result: { stage: 'waiting', queuePosition: 3 },
    })
    const { row } = await draw(job)
    expect(row.getByText('Waiting (place 3)')).toBeInTheDocument()
    expect(row.queryByText(/%/)).toBeNull()
  })

  it('says "Waiting" when the server gives no place', async () => {
    const { row } = await draw(videoRow({ status: 'running', result: { stage: 'waiting' } }))
    expect(row.getByText('Waiting')).toBeInTheDocument()
  })

  it('says "Working, m min" from the row\'s start time, with no percentage', async () => {
    const job = videoRow({
      status: 'running',
      progress: 0.4,
      createdAt: minutesAgo(3),
      result: { stage: 'working' },
    })
    const { row } = await draw(job)
    expect(row.getByText('Working, 3 min')).toBeInTheDocument()
    expect(row.queryByText(/%/)).toBeNull()
  })

  it('counts up the minutes while it works', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { row } = await draw(
      videoRow({ status: 'running', createdAt: minutesAgo(0), result: {} }),
    )
    expect(row.getByText('Working, 0 min')).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(61_000)
    })
    expect(row.getByText('Working, 1 min')).toBeInTheDocument()
  })

  it("keeps the row's own Cancel for a running ComfyUI video", async () => {
    const { row, sent } = await draw(videoRow({ status: 'running', result: {} }))
    await userEvent.click(row.getByRole('button', { name: 'Cancel' }))
    expect(sent('job.cancel').map((c) => c.input)).toEqual([{ projectId: 'P1', jobId: 'J1' }])
  })

  it("keeps the row's own sentence and Retry for a failed video", async () => {
    const { row, sent } = await draw(videoRow({ status: 'failed', errorKind: 'timeout' }))
    expect(row.getByText(/^Video · ComfyUI$/)).toBeInTheDocument()
    expect(row.getByText('Failed')).toBeInTheDocument()
    expect(row.getByText(plainMessage('timeout', 'ComfyUI'))).toBeInTheDocument()
    await userEvent.click(row.getByRole('button', { name: 'Retry' }))
    expect(sent('job.retry').map((c) => c.input)).toEqual([{ projectId: 'P1', jobId: 'J1' }])
  })
})

describe('ActivityRow, a running picture run [SPEC 14 1.41 TP-2]', () => {
  it('says Working, with the stage, the place in the queue and the percent', async () => {
    const job = jobRow('J1', {
      status: 'running',
      progress: 0.4,
      result: { stage: 'waiting', queuePosition: 3 },
    })
    const { row } = await draw(job)
    expect(row.getByText('Working')).toBeInTheDocument()
    expect(row.getByText('waiting · place in queue 3 · 40%')).toBeInTheDocument()
  })
})
