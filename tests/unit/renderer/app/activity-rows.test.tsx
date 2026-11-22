// SH-4 (spec/phases/design-wave-screens-a.md, "SH-4 — Activity panel"): a PanelHead with ✕,
// Running and Finished as Sections with their counts, compact rows with a status mark and one
// action, Retry keeping the paid rule (C-15), failures visible, and the empty states.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ActivityButton } from '@/renderer/app/activity-button'
import { ActivityPanel, ActivityScope } from '@/renderer/app/activity-panel'
import { ActivityRow } from '@/renderer/app/activity-row'
import { NavScope } from '@/renderer/app/nav-context'
import { plainMessage } from '@/shared/providers/messages'
import type { JobActivity, JobPlace } from '@/shared/schemas/queries/activity'
import type { JobRow } from '@/shared/schemas/rows/job'
import { axeViolations, renderApp } from '../render'
import { baseState, makeFakeApi } from '../fake-api'
import { costLine } from '../cost-line'
import { LOCAL } from '../screens/campaign/campaign-fixture'
import { videoRow } from '../screens/campaign/video-fixture'
import { jobRow } from '../stores/job-fixture'

const PLACE: JobPlace = { campaignName: 'Spring', variantLabel: 'Hero · 1:1 · en', layerName: null }
const NO_PLACE: JobPlace = { campaignName: null, variantLabel: null, layerName: null }
const WHERE = 'Go to Spring › Hero · 1:1 · en'

const JOBS: JobActivity = [
  { job: jobRow('F1', { status: 'failed', errorKind: 'quota' }), place: PLACE },
  { job: jobRow('S1', { status: 'succeeded', seenAt: null }), place: PLACE },
  { job: jobRow('R1', { status: 'running', provider: 'fake' }), place: PLACE },
]

async function drawPanel(projectId: string | null, jobs: JobActivity = JOBS) {
  const fake = makeFakeApi(baseState({ providers: [...baseState().providers, LOCAL] }))
  fake.onQuery('job.activity', () => ({ ok: true, data: jobs }))
  await renderApp(
    <NavScope>
      <ActivityScope projectId={projectId}>
        <header>
          <ActivityButton />
        </header>
        <main>
          <ActivityPanel />
        </main>
      </ActivityScope>
    </NavScope>,
    fake,
  )
  if (projectId !== null) {
    await expect.poll(() => fake.queries.some((q) => q.name === 'job.activity')).toBe(true)
  }
  await userEvent.click(screen.getByRole('button', { name: /^Activity/ }))
  return screen.getByRole('region', { name: 'Activity' })
}

async function drawRow(job: JobRow, place: JobPlace = PLACE) {
  const fake = makeFakeApi(baseState({ providers: [...baseState().providers, LOCAL] }))
  const onGo = vi.fn()
  await renderApp(
    <main>
      <ul aria-label="Jobs">
        <ActivityRow entry={{ job, place }} projectId="P1" onGo={onGo} />
      </ul>
    </main>,
    fake,
  )
  const sent = (name: string) => fake.commands.filter((c) => c.name === name)
  const retries = () => sent('job.retry')
  return { onGo, sent, retries, row: within(screen.getByRole('listitem')) }
}

describe('Activity panel head and lists [SH-4]', () => {
  it('has a PanelHead whose ✕ is named "Close activity" and closes', async () => {
    const panel = await drawPanel('P1')
    expect(panel).toHaveAttribute('data-density', 'compact')
    expect(within(panel).getByRole('heading', { name: 'Activity', level: 2 })).toBeVisible()
    expect(within(panel).queryByText('Close activity')).toBeNull()
    await userEvent.click(within(panel).getByRole('button', { name: 'Close activity' }))
    expect(screen.queryByRole('region', { name: 'Activity' })).toBeNull()
  })

  it('shows Running and Finished with their counts', async () => {
    const panel = await drawPanel('P1')
    const running = within(panel).getByRole('region', { name: 'Running' })
    const finished = within(panel).getByRole('region', { name: 'Finished' })
    expect(within(running).getByText('1')).toBeVisible()
    expect(within(finished).getByText('2')).toBeVisible()
    expect(within(running).getByRole('list', { name: 'Running' })).toBeInTheDocument()
    expect(within(finished).getByRole('list', { name: 'Finished' })).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    await drawPanel('P1')
    expect(await axeViolations()).toEqual([])
  })
})

describe('Activity panel empty states [SH-4]', () => {
  it.each<[string, string | null, string]>([
    ['with no project shown', null, 'No project open'],
    ['with nothing run', 'P1', 'No runs yet'],
  ])('says so %s, with no action', async (_name, projectId, words) => {
    const panel = await drawPanel(projectId, [])
    expect(await within(panel).findByText(words)).toBeVisible()
    expect(within(panel).getAllByRole('button')).toHaveLength(1)
  })
})

describe('Activity row [SH-4]', () => {
  it('goes there on click and on Enter through the button named "Go to {where}"', async () => {
    const { row, onGo } = await drawRow(jobRow('J1', { status: 'succeeded' }))
    const go = row.getByRole('button', { name: WHERE })
    await userEvent.click(go)
    await vi.waitFor(() => expect(onGo).toHaveBeenCalledTimes(1))
    go.focus()
    await userEvent.keyboard('{Enter}')
    await vi.waitFor(() => expect(onGo).toHaveBeenCalledTimes(2))
  })

  it('has no button for a row with no place to go', async () => {
    const { row } = await drawRow(jobRow('J1', { status: 'succeeded' }), NO_PLACE)
    expect(row.queryAllByRole('button')).toEqual([])
  })

  it('shows the time in the meta line', async () => {
    const createdAt = new Date(2026, 10, 21, 9, 5).toISOString()
    const { row } = await drawRow(jobRow('J1', { status: 'succeeded', createdAt }))
    expect(row.getByText('09:05')).toBeVisible()
    expect(row.queryByText(/^Started/)).toBeNull()
  })

  it('shows the spinner and an icon Cancel for a running job', async () => {
    const { row } = await drawRow(jobRow('J1', { status: 'running', provider: 'fake' }))
    expect(row.getByTitle('Working').querySelector('svg')).not.toBeNull()
    expect(row.getByRole('button', { name: 'Cancel' })).toHaveAttribute('title', 'Cancel')
    expect(row.queryByText('Cancel')).toBeNull()
  })

  it('opens the run dialog from Retry of a paid picture run', async () => {
    const { row, retries } = await drawRow(jobRow('J1', { status: 'failed' }))
    const retry = row.getByRole('button', { name: 'Retry' })
    expect(row.queryByText('Retry')).toBeNull()
    await userEvent.click(retry)
    const dialog = within(await screen.findByRole('dialog', { name: 'Retry the run' }))
    expect(dialog.getByText(costLine('Paid: 2 pictures → Google Gemini'))).toBeVisible()
    expect(retries()).toEqual([])
  })

  it('shows the two-step line with Confirm from Retry of a paid video', async () => {
    const { row, retries } = await drawRow(videoRow({ status: 'failed', provider: 'gemini' }))
    await userEvent.click(row.getByRole('button', { name: 'Retry' }))
    expect(row.getByText(costLine('Paid: 1 request → Google Gemini'))).toBeVisible()
    expect(retries()).toEqual([])
    await userEvent.click(row.getByRole('button', { name: 'Confirm' }))
    expect(retries()).toHaveLength(1)
  })

  it('keeps the hidden words for a job an agent started', async () => {
    const { row } = await drawRow(jobRow('J1', { status: 'succeeded', startedBy: 'agent' }))
    expect(row.getByText('Started by an agent').className).toMatch(/hidden/)
  })

  it('marks an unseen result with the "New result" dot', async () => {
    const { row } = await drawRow(jobRow('J1', { status: 'succeeded', seenAt: null }))
    expect(row.getByTitle('New result')).toBeInTheDocument()
  })

  it('keeps the failure sentence visible', async () => {
    const { row } = await drawRow(jobRow('J1', { status: 'failed', errorKind: 'quota' }))
    expect(row.getByText(plainMessage('quota', 'Google Gemini'))).toBeVisible()
    expect(row.getByText('Failed')).toBeVisible()
  })

  it('keeps "Cancelled" as visible words', async () => {
    const { row } = await drawRow(jobRow('J1', { status: 'cancelled' }))
    expect(row.getByText('Cancelled')).toBeVisible()
  })

  it('sends one job.cancel per click on Cancel, as before', async () => {
    const { row, sent } = await drawRow(jobRow('J1', { status: 'queued' }))
    await userEvent.click(row.getByRole('button', { name: 'Cancel' }))
    expect(sent('job.cancel').map((c) => c.input)).toEqual([{ projectId: 'P1', jobId: 'J1' }])
  })

  it('puts no path from the job into its text, names or attributes', async () => {
    const request = { prompt: 'A can', sourcePath: '/Users/someone/private/can.png', count: 2 }
    const result = { filePath: '/Users/someone/private/out.png' }
    await drawRow(jobRow('J1', { status: 'failed', errorKind: 'other', request, result }))
    expect(screen.getByRole('listitem').outerHTML).not.toContain('/Users/')
  })
})
