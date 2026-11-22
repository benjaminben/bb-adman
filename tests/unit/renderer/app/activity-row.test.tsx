// P4-14 (spec/screens-ai.md, "The activity panel", Row): what and where, status and marks,
// Go there, Cancel by the rule, Retry for background jobs only (paid through the run dialog),
// and the failure sentence.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ActivityRow } from '@/renderer/app/activity-row'
import type { JobPlace } from '@/shared/schemas/queries/activity'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import { plainMessage } from '@/shared/providers/messages'
import { axeViolations, renderApp } from '../render'
import { baseState, makeFakeApi } from '../fake-api'
import { jobRow } from '../stores/job-fixture'

const FAKE: ProviderInfo = {
  id: 'fake',
  label: 'Fake provider',
  jobs: ['image', 'layout', 'text', 'video'],
  available: true,
  secrets: [],
  defaultModels: {},
  local: true,
  cancel: 'stops',
  serverText: false,
}

const PLACE: JobPlace = {
  campaignName: 'Spring',
  variantLabel: 'Hero · 1:1 · en',
  layerName: 'Can',
}
const NO_PLACE: JobPlace = { campaignName: null, variantLabel: null, layerName: null }

type Over = Parameters<typeof jobRow>[1]

async function draw(over: Over, place: JobPlace = PLACE, onGo = vi.fn()) {
  const state = baseState()
  const fake = makeFakeApi(baseState({ providers: [...state.providers, FAKE] }))
  const view = await renderApp(
    <main>
      <ul aria-label="Jobs">
        <ActivityRow entry={{ job: jobRow('J1', over), place }} projectId="P1" onGo={onGo} />
      </ul>
    </main>,
    fake,
  )
  return { ...view, fake, onGo, row: screen.getByRole('listitem') }
}

const sent = (fake: ReturnType<typeof makeFakeApi>, name: string) =>
  fake.commands.filter((c) => c.name === name)

describe('ActivityRow what and where [P4-14, FR-217]', () => {
  it.each<[string, Over, JobPlace, string, string]>([
    [
      'pictures',
      { layerId: 'L1' },
      PLACE,
      'Pictures (2) · Google Gemini',
      'Spring › Hero · 1:1 · en › Can',
    ],
    [
      'video',
      { kind: 'video_generation', provider: 'fal-seedance' },
      PLACE,
      'Video · fal.ai Seedance',
      'Spring › Hero · 1:1 · en',
    ],
    [
      'a cut-out',
      { kind: 'cutout', layerId: 'L1', provider: 'fake' },
      PLACE,
      'Cut-out · Fake provider',
      'Spring › Hero · 1:1 · en › Can',
    ],
    [
      'a text layout',
      { kind: 'layout_proposal', slot: null },
      PLACE,
      'Text layout · Google Gemini',
      'Spring › Hero · 1:1 · en',
    ],
    [
      'copy options',
      { kind: 'copy_options', request: { count: 3 }, layerId: 'L1' },
      PLACE,
      'Copy options (3) · Google Gemini',
      'Spring › Hero · 1:1 · en › Can',
    ],
    [
      'a brief reading',
      { kind: 'brief_extraction', campaignId: null, variantId: null, slot: null },
      NO_PLACE,
      'Reading a brief · Google Gemini',
      'Project',
    ],
    [
      'a campaign job',
      { variantId: null },
      { ...PLACE, variantLabel: null, layerName: null },
      'Pictures (2) · Google Gemini',
      'Spring',
    ],
    [
      'deleted parts',
      { layerId: 'L1' },
      { ...PLACE, variantLabel: null, layerName: null },
      'Pictures (2) · Google Gemini',
      'Spring › (deleted) › (deleted)',
    ],
  ])('words %s', async (_name, over, place, what, where) => {
    const { row } = await draw(over, place)
    expect(within(row).getByText(what)).toBeInTheDocument()
    expect(within(row).getByText(where)).toBeInTheDocument()
  })

  it('goes there in one click, labelled with the place', async () => {
    const { row, onGo } = await draw({ layerId: 'L1' })
    await userEvent.click(
      within(row).getByRole('button', { name: 'Go to Spring › Hero · 1:1 · en › Can' }),
    )
    expect(onGo).toHaveBeenCalledWith({
      to: 'layer',
      campaignId: 'C1',
      variantId: 'V1',
      layerId: 'L1',
    })
  })

  it('has no Go there for a gone campaign', async () => {
    const { row } = await draw({ layerId: 'L1' }, NO_PLACE)
    expect(within(row).queryByRole('button', { name: /^Go to/ })).toBeNull()
  })
})

describe('ActivityRow status and marks [P4-14, FR-218]', () => {
  it.each<[string, Over, string]>([
    ['queued', { status: 'queued' }, 'Waiting'],
    ['running with its detail', { status: 'running', progress: 0.4 }, 'Working'],
    ['succeeded', { status: 'succeeded', seenAt: '2026-11-21T00:02:00Z' }, 'Done'],
    ['cancelled', { status: 'cancelled' }, 'Cancelled'],
  ])('words the status %s as the run row does', async (_name, over, text) => {
    const { row } = await draw(over)
    expect(within(row).getByText(text)).toBeInTheDocument()
  })

  it('shows the start time, "Started by an agent" and the New mark', async () => {
    const createdAt = new Date(2026, 10, 21, 9, 5).toISOString()
    const { row } = await draw({ status: 'succeeded', startedBy: 'agent', createdAt })
    expect(within(row).getByText('Started 09:05')).toBeInTheDocument()
    expect(within(row).getByText('Started by an agent')).toBeInTheDocument()
    expect(within(row).getByText('New')).toBeInTheDocument()
  })

  it('shows no New mark once looked at', async () => {
    const { row } = await draw({ status: 'succeeded', seenAt: '2026-11-21T00:02:00Z' })
    expect(within(row).queryByText('New')).toBeNull()
  })

  it('shows the failure sentence', async () => {
    const { row } = await draw({ status: 'failed', errorKind: 'quota' })
    expect(within(row).getByText(plainMessage('quota', 'Google Gemini'))).toBeInTheDocument()
  })
})

describe('ActivityRow Cancel and Retry [P4-14, D-036, A-63]', () => {
  it('cancels a queued job', async () => {
    const { row, fake } = await draw({ status: 'queued' })
    await userEvent.click(within(row).getByRole('button', { name: 'Cancel' }))
    expect(sent(fake, 'job.cancel')[0]?.input).toEqual({ projectId: 'P1', jobId: 'J1' })
  })

  it('offers no Cancel where job.cancel would refuse', async () => {
    const { row } = await draw({ status: 'running', kind: 'cutout' })
    expect(within(row).queryByRole('button', { name: 'Cancel' })).toBeNull()
  })

  it.each<[string, Over]>([
    ['a failed text layout', { status: 'failed', kind: 'layout_proposal' }],
    ['a cancelled copy options run', { status: 'cancelled', kind: 'copy_options' }],
    ['a succeeded picture run', { status: 'succeeded' }],
  ])('offers no Retry for %s', async (_name, over) => {
    const { row } = await draw(over)
    expect(within(row).queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  // P9-13: a publish is started again from the campaign, so job.retry refuses it.
  it('offers no Retry for a failed publish [P9-13]', async () => {
    const { row } = await draw({ status: 'failed', kind: 'publish', provider: null })
    expect(within(row).queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it('retries a local background job at once', async () => {
    const { row, fake } = await draw({ status: 'cancelled', kind: 'cutout', provider: 'fake' })
    await userEvent.click(within(row).getByRole('button', { name: 'Retry' }))
    expect(sent(fake, 'job.retry')[0]?.input).toEqual({ projectId: 'P1', jobId: 'J1' })
  })

  it('retries a paid job through the run dialog in retry mode', async () => {
    const { row, fake } = await draw({ status: 'failed', errorKind: 'other' })
    fake.onCommand('job.retry', () => ({ ok: true, data: { jobId: 'J2' } }))
    await userEvent.click(within(row).getByRole('button', { name: 'Retry' }))
    expect(sent(fake, 'job.retry')).toHaveLength(0)
    const dialog = await screen.findByRole('dialog', { name: 'Retry the run' })
    expect(within(dialog).getByText('Provider: Google Gemini')).toBeInTheDocument()
    expect(within(dialog).getByText('Pictures: 2')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Retry' }))
    expect(sent(fake, 'job.retry')[0]?.input).toEqual({ projectId: 'P1', jobId: 'J1' })
    await expect.poll(() => screen.queryByRole('dialog')).toBeNull()
  })

  it('retries a paid video job after the one-line paid confirm', async () => {
    const over: Over = { status: 'failed', kind: 'video_generation', provider: 'fal-seedance' }
    const { row, fake } = await draw(over)
    await userEvent.click(within(row).getByRole('button', { name: 'Retry' }))
    expect(
      within(row).getByText(/^This sends .*paid request\(s\) to fal.ai Seedance/),
    ).toBeVisible()
    await userEvent.click(within(row).getByRole('button', { name: 'Confirm' }))
    expect(sent(fake, 'job.retry')).toHaveLength(1)
  })

  it('has no accessibility violations', async () => {
    await draw({ status: 'failed', errorKind: 'other', layerId: 'L1' })
    expect(await axeViolations()).toEqual([])
  })
})
