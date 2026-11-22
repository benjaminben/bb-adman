// R2E-6 (spec/phases/round-2-editor.md D6, "Result notice"): one line when a picture, video,
// cut-out or extended-picture job of the shown project turns succeeded unseen, while the window
// does not show its layer (or its variant). The newest replaces an older one; Show goes there
// and closes it; Dismiss closes it; it closes when the job is marked seen. It sends no
// job.markSeen and starts nothing.
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { describe, expect, it } from 'vitest'
import { ActivityScope } from '@/renderer/app/activity-panel'
import { NavScope, useNavStore } from '@/renderer/app/nav-context'
import { ResultNotice } from '@/renderer/app/result-notice'
import { campaignNav, projectNav, tabView, type NavStore } from '@/renderer/stores/nav-store'
import type { JobActivity, JobPlace } from '@/shared/schemas/queries/activity'
import type { JobRow } from '@/shared/schemas/rows/job'
import { axeViolations, renderApp } from '../render'
import { makeFakeApi } from '../fake-api'
import { jobRow } from '../stores/job-fixture'

const CAN: JobPlace = { campaignName: 'Spring', variantLabel: 'Hero · 1:1 · en', layerName: 'Can' }
const LOGO: JobPlace = { ...CAN, layerName: 'Logo' }
const OLD = '2026-11-21T00:00:00.000Z'

let nav: NavStore
function Grab() {
  const store = useNavStore()
  useEffect(() => {
    nav = store
  }, [store])
  return null
}

async function draw(jobs: JobActivity) {
  const fake = makeFakeApi()
  fake.onQuery('job.activity', () => ({ ok: true, data: jobs }))
  const view = await renderApp(
    <NavScope>
      <ActivityScope projectId="P1">
        <Grab />
        <main>
          <ResultNotice projectId="P1" />
        </main>
      </ActivityScope>
    </NavScope>,
    fake,
  )
  await act(async () => {})
  return { ...view, fake }
}

let tick = 0
const later = () => new Date(Date.now() + 1000 + ++tick).toISOString()

function finish(fake: ReturnType<typeof makeFakeApi>, job: JobRow, over: Partial<JobRow> = {}) {
  act(() => fake.emit('job.updated', { ...job, status: 'succeeded', updatedAt: later(), ...over }))
}

const running = (id: string, over: Partial<JobRow> = {}) =>
  jobRow(id, { status: 'running', layerId: 'L1', updatedAt: OLD, ...over })

const notice = () => screen.getByRole('status')

describe('ResultNotice words [R2E-6]', () => {
  it.each<[JobRow['kind'], string]>([
    ['image_generation', 'New pictures are ready: Spring › Hero · 1:1 · en › Can.'],
    ['video_generation', 'A new video is ready: Spring › Hero · 1:1 · en › Can.'],
    ['cutout', 'A cut-out is ready: Spring › Hero · 1:1 · en › Can.'],
    ['generative_fill', 'An extended picture is ready: Spring › Hero · 1:1 · en › Can.'],
  ])('words a finished %s', async (kind, words) => {
    const job = running('J1', { kind })
    const { fake } = await draw([{ job, place: CAN }])
    expect(notice()).toBeEmptyDOMElement()
    finish(fake, job)
    expect(notice()).toHaveTextContent(words)
    expect(screen.getByRole('button', { name: 'Show' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
  })

  it('stays quiet for other kinds, failed runs and results already seen', async () => {
    const jobs = [running('J1', { kind: 'export' }), running('J2'), running('J3')]
    const { fake } = await draw(jobs.map((job) => ({ job, place: CAN })))
    finish(fake, jobs[0])
    finish(fake, jobs[1], { status: 'failed' })
    finish(fake, jobs[2], { seenAt: later() })
    expect(notice()).toBeEmptyDOMElement()
  })

  it('says nothing of a result that was ready before the project was shown', async () => {
    const job = jobRow('J1', { status: 'succeeded', layerId: 'L1', updatedAt: OLD })
    await draw([{ job, place: CAN }])
    expect(notice()).toBeEmptyDOMElement()
  })
})

describe('ResultNotice place on screen [R2E-6]', () => {
  it('is not shown while its layer is shown', async () => {
    const job = running('J1')
    const { fake } = await draw([{ job, place: CAN }])
    act(() => {
      nav.getState().openCampaign('P1', 'C1')
      nav.getState().openVariant('P1', 'C1', 'V1')
      nav.getState().setView('P1', 'V1', { selectedLayerId: 'L1' })
    })
    finish(fake, job)
    expect(notice()).toBeEmptyDOMElement()
    act(() => nav.getState().setView('P1', 'V1', { selectedLayerId: 'L2' }))
    expect(notice()).toHaveTextContent('New pictures are ready')
  })

  it('is not shown while the variant of a job with no layer is shown', async () => {
    const job = running('J1', { kind: 'video_generation', layerId: null, slot: null })
    const { fake } = await draw([{ job, place: { ...CAN, layerName: null } }])
    act(() => {
      nav.getState().openCampaign('P1', 'C1')
      nav.getState().openVariant('P1', 'C1', 'V1')
    })
    finish(fake, job)
    expect(notice()).toBeEmptyDOMElement()
  })
})

describe('ResultNotice actions [R2E-6]', () => {
  it('shows only the newest, and an older one does not come back', async () => {
    const [one, two] = [running('J1'), running('J2', { layerId: 'L2' })]
    const { fake } = await draw([
      { job: two, place: LOGO },
      { job: one, place: CAN },
    ])
    finish(fake, one)
    finish(fake, two)
    expect(notice()).toHaveTextContent('Spring › Hero · 1:1 · en › Logo.')
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(notice()).toBeEmptyDOMElement()
  })

  it('Show goes to the layer and closes the line, sending no job.markSeen', async () => {
    const job = running('J1')
    const { fake } = await draw([{ job, place: CAN }])
    finish(fake, job)
    await userEvent.click(screen.getByRole('button', { name: 'Show' }))
    expect(notice()).toBeEmptyDOMElement()
    const s = nav.getState()
    expect(projectNav(s, 'P1').shown).toBe('C1')
    expect(campaignNav(s, 'P1', 'C1').shown).toBe('V1')
    expect(tabView(s, 'P1', 'V1').selectedLayerId).toBe('L1')
    expect(fake.commands).toEqual([])
  })

  it('closes when the job is marked seen', async () => {
    const job = running('J1')
    const { fake } = await draw([{ job, place: CAN }])
    finish(fake, job)
    finish(fake, job, { seenAt: later() })
    expect(notice()).toBeEmptyDOMElement()
  })

  it('has no accessibility violations', async () => {
    const job = running('J1')
    const { fake } = await draw([{ job, place: CAN }])
    finish(fake, job)
    expect(await axeViolations()).toEqual([])
  })
})
