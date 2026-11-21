// AR-1 (security class): job.cancel sent by an agent passes the gate only for a run the agent
// started; no tick is needed; then cancelRefusal applies as for the user (spec/agent-runs.md
// "job.cancel for an agent", spec/cancel.md).
import { describe, it, expect, afterEach } from 'vitest'
import { gate, makeRunnerFixture, waitFor, type RunnerFixture } from '../jobs/runner-fixture'
import { ProviderCancelled } from '@/main/providers/types'

const fixtures: RunnerFixture[] = []
function fixture(): RunnerFixture {
  const f = makeRunnerFixture({ cancelWaitMs: 60, jobsAtOnce: 1 })
  fixtures.push(f)
  return f
}
afterEach(() => {
  while (fixtures.length) fixtures.pop()?.cleanup()
})

const OWN_ONLY = 'Agents can cancel only runs they started.'

// The fake body waits until the job's signal fires, then ends cancelled.
function waitsForCancel(x: RunnerFixture): void {
  x.f.body = async (jc) => {
    await new Promise((r) => jc.signal.addEventListener('abort', r))
    throw new ProviderCancelled()
  }
}

describe('job.cancel from an agent [spec/agent-runs.md, AR-1]', () => {
  it('cancels the agent its own queued job', async () => {
    const x = fixture()
    waitsForCancel(x)
    const first = await x.start()
    await waitFor(() => x.row(first)?.status === 'running')
    const own = await x.start({ startedBy: 'agent' })
    expect(x.row(own)?.status).toBe('queued')
    expect(await x.agent('job.cancel', { projectId: x.projectId, jobId: own })).toEqual({
      ok: true,
      data: { jobId: own },
    })
    await waitFor(() => x.row(own)?.status === 'cancelled')
    await x.user('job.cancel', { projectId: x.projectId, jobId: first })
  })

  it('cancels the agent its own running job: it ends cancelled', async () => {
    const x = fixture()
    waitsForCancel(x)
    const own = await x.start({ startedBy: 'agent' })
    await waitFor(() => x.row(own)?.status === 'running')
    expect((await x.agent('job.cancel', { projectId: x.projectId, jobId: own })).ok).toBe(true)
    await waitFor(() => x.row(own)?.status === 'cancelled')
  })

  it("refuses a user's job, queued or running, and the job goes on", async () => {
    const x = fixture()
    const g = gate()
    x.f.body = async () => g.promise
    const running = await x.start()
    await waitFor(() => x.row(running)?.status === 'running')
    const queued = await x.start()
    for (const jobId of [running, queued]) {
      expect(await x.agent('job.cancel', { projectId: x.projectId, jobId })).toEqual({
        ok: false,
        error: { code: 'AGENT_DENIED', message: OWN_ONLY },
      })
    }
    expect(x.row(running)?.status).toBe('running')
    expect(x.row(queued)?.status).toBe('queued')
    g.open()
  })

  it('gives NOT_FOUND for a job that is not in the project', async () => {
    const x = fixture()
    expect(await x.agent('job.cancel', { projectId: x.projectId, jobId: 'nope' })).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    })
  })

  it('applies cancelRefusal as for the user: cancel_not_supported on a provider that cannot', async () => {
    const x = fixture()
    const g = gate()
    x.f.body = async () => g.promise
    const own = await x.start({
      startedBy: 'agent',
      provider: 'no-cancel',
      kind: 'video_generation',
    })
    await waitFor(() => x.row(own)?.status === 'running')
    expect(await x.agent('job.cancel', { projectId: x.projectId, jobId: own })).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'cancel_not_supported' } },
    })
    g.open()
  })
})
