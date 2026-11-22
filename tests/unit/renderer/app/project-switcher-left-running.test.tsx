// P7-15 (A-174): the "Close {project}?" warning adds the left-running line for each paid
// provider with started video runs the close leaves running (spec/cancel.md, "Closing a
// project"): a running video row with a remote ID, at stage working, of a provider that is not
// local and whose cancel is may_finish. The rows are read with job.activity for the project.
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ProjectSwitcher } from '@/renderer/app/project-switcher'
import type { JobRow } from '@/shared/schemas/rows/job'
import { renderApp } from '../render'
import { baseState, makeFakeApi } from '../fake-api'
import { jobRow } from '../stores/job-fixture'

const SUMMER = { projectId: 'P1', name: 'Summer', filePath: '/w/Summer.adman' }
const START =
  '{n} runs are still going in this project. Closing stops them. Requests already sent to a ' +
  'paid provider may still be charged, and their results are lost.'

const started = (id: string, over: Partial<JobRow> = {}) =>
  jobRow(id, {
    kind: 'video_generation',
    status: 'running',
    provider: 'fal-seedance',
    remoteJobId: `r-${id}`,
    result: { stage: 'working' },
    ...over,
  })

async function draw(rows: JobRow[]) {
  const fake = makeFakeApi(baseState({ openProjects: [SUMMER] }))
  fake.onCommand('project.close', (input) =>
    (input as { runningJobs?: string }).runningJobs === 'stop'
      ? { ok: true, data: { projectId: 'P1' } }
      : {
          ok: false,
          error: {
            code: 'RULE_VIOLATION',
            message: 'Work is still running in this project. Stop it, or wait for it to finish.',
            details: { reason: 'jobs_running', count: rows.length },
          },
        },
  )
  fake.onQuery('job.activity', () => ({
    ok: true,
    data: rows.map((job) => ({
      job,
      place: { campaignName: null, variantLabel: null, layerName: null },
    })),
  }))
  const view = await renderApp(
    <header>
      <ProjectSwitcher />
    </header>,
    fake,
  )
  act(() => view.store.getState().show({ kind: 'project', projectId: 'P1' }))
  return fake
}

async function closeSummer() {
  await userEvent.click(screen.getByRole('button', { name: 'Summer' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Close project' }))
  return screen.findByRole('dialog', { name: 'Close Summer?' })
}

describe('the project close warning names runs left running [P7-15, A-174]', () => {
  it.each([
    [
      [started('a'), jobRow('b', { status: 'running' })],
      'fal.ai Seedance has started 1 video and will charge for it. It keeps running; open the project again to collect it.',
    ],
    [
      [started('a'), started('b'), started('c', { result: { stage: 'waiting' } })],
      'fal.ai Seedance has started 2 videos and will charge for them. They keep running; open the project again to collect them.',
    ],
  ])('adds the line, singular and plural', async (rows, line) => {
    const fake = await draw(rows)
    const dialog = await closeSummer()
    const start = START.replace(
      '{n} runs are still going in this project. Closing stops them.',
      '1 run is still going in this project. Closing stops it.',
    )
    expect(dialog).toHaveAccessibleDescription(`${start} ${line}`)
    expect(fake.queries).toContainEqual({
      name: 'job.activity',
      input: { projectId: 'P1', limit: 500 },
    })
  })

  it.each([
    ['a run with no remote ID', started('a', { remoteJobId: null })],
    ['a run still waiting', started('a', { result: { stage: 'waiting' } })],
    ['a local provider', started('a', { provider: 'comfyui' })],
    ['a picture run', started('a', { kind: 'image_generation' })],
    ['a queued run', started('a', { status: 'queued' })],
  ])('adds no line for %s', async (_name, row) => {
    const fake = await draw([row, jobRow('b', { status: 'running' })])
    await closeSummer()
    const dialog = await screen.findByRole('dialog', { name: 'Close Summer?' })
    expect(dialog).toHaveAccessibleDescription(START.replace('{n} runs are', '2 runs are'))
    expect(fake.queries.some((q) => q.name === 'job.activity')).toBe(true)
  })
})

// P7-15b: the first sentence counts only the runs the close really stops.
describe('the project close warning counts only the runs it stops [P7-15b]', () => {
  const ONE =
    'fal.ai Seedance has started 1 video and will charge for it. It keeps running; open the project again to collect it.'

  it('counts the other runs, not the left-running one', async () => {
    await draw([
      started('a'),
      jobRow('b', { status: 'running' }),
      jobRow('c', { status: 'queued' }),
    ])
    const dialog = await closeSummer()
    expect(dialog).toHaveAccessibleDescription(`${START.replace('{n}', '2')} ${ONE}`)
  })

  it('shows only the left-running line when every run keeps running', async () => {
    await draw([started('a')])
    const dialog = await closeSummer()
    expect(dialog).toHaveAccessibleDescription(ONE)
  })
})
