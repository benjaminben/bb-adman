// P4-14 (spec/screens-ai.md, "The activity panel"): the button with its marks, the panel's two
// lists and their order, the start-screen line, the empty line, Escape and Go there.
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ActivityButton } from '@/renderer/app/activity-button'
import { ActivityPanel, ActivityScope, ShownActivityScope } from '@/renderer/app/activity-panel'
import { NavScope, useNav } from '@/renderer/app/nav-context'
import { projectNav } from '@/renderer/stores/nav-store'
import type { JobActivity } from '@/shared/schemas/queries/activity'
import { axeViolations, renderApp } from '../render'
import { baseState, makeFakeApi } from '../fake-api'
import { jobRow } from '../stores/job-fixture'

const PLACE = { campaignName: 'Spring', variantLabel: 'Hero · 1:1 · en', layerName: null }

const at = (minute: number) => `2026-11-21T10:${String(minute).padStart(2, '0')}:00.000Z`

// job.activity answers newest first.
const JOBS: JobActivity = [
  { job: jobRow('F2', { status: 'failed', kind: 'cutout', createdAt: at(5) }), place: PLACE },
  {
    job: jobRow('R2', { status: 'running', kind: 'video_generation', createdAt: at(4) }),
    place: PLACE,
  },
  {
    job: jobRow('Q1', { status: 'queued', kind: 'layout_proposal', createdAt: at(3) }),
    place: PLACE,
  },
  { job: jobRow('S1', { status: 'succeeded', createdAt: at(2) }), place: PLACE },
  { job: jobRow('R1', { status: 'running', createdAt: at(1) }), place: PLACE },
]

function Shown() {
  const shown = useNav((s) => projectNav(s, 'P1').shown)
  return <p>Shown tab: {shown}</p>
}

async function draw(projectId: string | null, jobs: JobActivity = JOBS) {
  const fake = makeFakeApi()
  fake.onQuery('job.activity', () => ({ ok: true, data: jobs }))
  const view = await renderApp(
    <NavScope>
      <ActivityScope projectId={projectId}>
        <header>
          <ActivityButton />
        </header>
        <main>
          <Shown />
          <ActivityPanel />
        </main>
      </ActivityScope>
    </NavScope>,
    fake,
  )
  return { ...view, fake }
}

const button = () => screen.getByRole('button', { name: /^Activity/ })

async function openPanel() {
  await userEvent.click(button())
  return screen.getByRole('region', { name: 'Activity' })
}

const ids = (list: HTMLElement) =>
  within(list)
    .getAllByRole('listitem')
    .map((li) => li.textContent ?? '')

describe('ActivityButton [P4-14, FR-218]', () => {
  it('says how many run and marks a result not yet looked at', async () => {
    await draw('P1')
    expect(await screen.findByText('3 running')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'New results' })).toBeInTheDocument()
    expect(button()).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows no marks with nothing running or new', async () => {
    const seen = { status: 'succeeded' as const, seenAt: at(9) }
    const { fake } = await draw('P1', [{ job: jobRow('S1', seen), place: PLACE }])
    await expect.poll(() => fake.queries.some((q) => q.name === 'job.activity')).toBe(true)
    expect(screen.queryByText(/running$/)).toBeNull()
    expect(screen.queryByRole('img', { name: 'New results' })).toBeNull()
  })
})

describe('ActivityPanel [P4-14, FR-152]', () => {
  it('lists Running oldest first and Finished newest first', async () => {
    await draw('P1')
    await screen.findByText('3 running')
    const panel = await openPanel()
    expect(button()).toHaveAttribute('aria-expanded', 'true')
    const running = within(panel).getByRole('list', { name: 'Running' })
    const finished = within(panel).getByRole('list', { name: 'Finished' })
    expect(ids(running).map((t) => t.split(' · ')[0])).toEqual([
      'Pictures (2)',
      'Text layout',
      'Video',
    ])
    expect(ids(finished).map((t) => t.split(' · ')[0])).toEqual(['Cut-out', 'Pictures (2)'])
  })

  it('says to open a project on the start screen', async () => {
    const { fake } = await draw(null)
    await openPanel()
    expect(screen.getByText('No project open')).toBeInTheDocument()
    expect(fake.queries.some((q) => q.name === 'job.activity')).toBe(false)
  })

  it('says when nothing has run', async () => {
    await draw('P1', [])
    await openPanel()
    expect(await screen.findByText('No runs yet')).toBeInTheDocument()
  })

  it('closes with Escape and with Close activity', async () => {
    await draw('P1')
    await openPanel()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('region', { name: 'Activity' })).toBeNull()
    expect(button()).toHaveFocus()
    await openPanel()
    await userEvent.click(screen.getByRole('button', { name: 'Close activity' }))
    expect(screen.queryByRole('region', { name: 'Activity' })).toBeNull()
  })

  it('goes there and closes', async () => {
    await draw('P1')
    await screen.findByText('3 running')
    const panel = await openPanel()
    const go = within(panel).getAllByRole('button', { name: 'Go to Spring › Hero · 1:1 · en' })
    await userEvent.click(go[0] as HTMLElement)
    expect(screen.getByText('Shown tab: C1')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Activity' })).toBeNull()
  })

  it('has no accessibility violations', async () => {
    await draw('P1')
    await screen.findByText('3 running')
    await openPanel()
    expect(await axeViolations()).toEqual([])
  })
})

describe('ShownActivityScope [P4-14]', () => {
  it('reads the shown open project only', async () => {
    const projects = [{ projectId: 'P1', name: 'One', filePath: '/p/one.adman' }]
    const fake = makeFakeApi(baseState({ openProjects: projects }))
    fake.onQuery('job.activity', () => ({ ok: true, data: [] }))
    const { store } = await renderApp(
      <ShownActivityScope>
        <ActivityButton />
      </ShownActivityScope>,
      fake,
    )
    const asked = () => fake.queries.filter((q) => q.name === 'job.activity').map((q) => q.input)
    act(() => store.getState().show({ kind: 'settings' }))
    act(() => store.getState().show({ kind: 'project', projectId: 'P9' }))
    const before = asked().length
    act(() => store.getState().show({ kind: 'project', projectId: 'P1' }))
    await expect.poll(() => asked().slice(before)).toEqual([{ projectId: 'P1' }])
    expect(asked().every((input) => (input as { projectId: string }).projectId === 'P1')).toBe(true)
  })
})
