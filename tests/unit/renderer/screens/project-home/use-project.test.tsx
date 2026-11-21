// useProject (SPEC 14 1.41 TP-1; spec/jobs.md, "Marks" [FR-218]): project.get is read on open,
// on project.changed for this project, and on job.updated for a job of one of its campaigns
// whose mark moves (active, unseen or neither). Progress ticks of a running job read nothing.
import { act, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useProject } from '@/renderer/screens/project-home/project-home/use-project'
import type { JobRow } from '@/shared/schemas/rows/job'
import { renderApp } from '../../render'
import { jobRow } from '../../stores/job-fixture'
import { campaign, projectApi, projectGet } from './project-fixture'

function Probe() {
  const data = useProject('P1')
  return <p>{data ? `campaigns ${data.campaigns.length}` : 'loading'}</p>
}

async function draw() {
  const fake = projectApi(projectGet([campaign('C1', 'Summer Splash')]))
  await renderApp(<Probe />, fake)
  await screen.findByText('campaigns 1')
  const reads = () => fake.queries.filter((q) => q.name === 'project.get').length
  return { fake, reads }
}

const at = (n: number) => `2026-11-21T00:00:0${n}.000Z`
const queued = jobRow('J1', { status: 'queued', updatedAt: at(1) })
const running = jobRow('J1', { status: 'running', progress: 0.2, updatedAt: at(2) })
const tick = jobRow('J1', { status: 'running', progress: 0.6, updatedAt: at(3) })
const done = jobRow('J1', { status: 'succeeded', updatedAt: at(4) })
const seen = jobRow('J1', { status: 'succeeded', seenAt: at(5), updatedAt: at(5) })
const failed = jobRow('J1', { status: 'failed', updatedAt: at(4) })
const elsewhere = jobRow('J9', { campaignId: 'C9' })
const noCampaign = jobRow('J8', { campaignId: null })

describe('useProject re-reads on job.updated [FR-218]', () => {
  it.each<[string, JobRow[], number]>([
    ['a new queued job of its campaign', [queued], 1],
    ['queued then running (both active)', [queued, running], 1],
    ['progress ticks of a running job', [running, tick, tick], 1],
    ['a run that finishes with a result not looked at', [running, done], 2],
    ['a result then marked seen', [running, done, seen], 3],
    ['a run that fails', [running, failed], 2],
    ['a job of a campaign of another project', [elsewhere], 0],
    ['a job with no campaign', [noCampaign], 0],
  ])('%s', async (_, rows, extra) => {
    const { fake, reads } = await draw()
    const before = reads()
    for (const row of rows) act(() => fake.emit('job.updated', row))
    await act(async () => {})
    expect(reads() - before).toBe(extra)
  })

  it('still re-reads on project.changed for this project only', async () => {
    const { fake, reads } = await draw()
    const before = reads()
    const changed = { actor: 'user' as const, changed: {}, removed: {} }
    act(() => fake.emit('project.changed', { projectId: 'P2', ...changed }))
    act(() => fake.emit('project.changed', { projectId: 'P1', ...changed }))
    await act(async () => {})
    expect(reads() - before).toBe(1)
  })
})
