import { describe, it, expect, afterEach } from 'vitest'
import { gate, makeRunnerFixture, waitFor, type RunnerFixture } from './runner-fixture'

const fixtures: RunnerFixture[] = []
function fixture(): RunnerFixture {
  const f = makeRunnerFixture()
  fixtures.push(f)
  return f
}
afterEach(() => {
  while (fixtures.length) fixtures.pop()?.cleanup()
})

const done = (x: RunnerFixture, id: string) => () =>
  ['succeeded', 'failed', 'cancelled'].includes(x.row(id)?.status ?? '')

// A queued row this process did not enqueue, as a process that is gone would leave it.
function leftOverQueued(x: RunnerFixture, id: string, provider: string) {
  x.project.db
    .prepare(
      `INSERT INTO job (id, kind, status, provider, model, request, created_at, updated_at)
       VALUES (?, 'image_generation', 'queued', ?, 'm1', '{}',
               '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    )
    .run(id, provider)
}

describe('the runner starts only rows it enqueued [SPEC 3.6 "Jobs" item 2 1.38, 14 1.38 Y15]', () => {
  it('never starts a queued row it did not enqueue; projectOpened then cancels it', async () => {
    const x = fixture()
    leftOverQueued(x, 'old1', 'paid-test')
    const runs: string[] = []
    x.f.body = async (_jc, job) => {
      runs.push(job.id)
      return { done: true }
    }
    const id = await x.start({ provider: 'paid-test' })
    await waitFor(done(x, id))
    await new Promise((r) => setTimeout(r, 20))
    expect(runs).toEqual([id])
    expect(x.row('old1')).toMatchObject({ status: 'queued', paidCalls: 0 })
    await x.jobs.projectOpened(x.projectId)
    expect(x.row('old1')?.status).toBe('cancelled')
    expect(x.row(id)?.status).toBe('succeeded')
  })

  it('projectOpened leaves alone the jobs this process enqueued or is running', async () => {
    const x = fixture()
    const g = gate()
    x.f.body = async () => g.promise
    const ids: string[] = []
    for (let i = 0; i < 4; i++) ids.push(await x.start())
    await waitFor(() => x.f.calls === 3)
    await x.jobs.projectOpened(x.projectId)
    await x.jobs.projectOpened(x.projectId)
    expect(ids.map((id) => x.row(id)?.status)).toEqual(['running', 'running', 'running', 'queued'])
    g.open()
    await waitFor(() => ids.every((id) => done(x, id)()))
    expect(ids.map((id) => x.row(id)?.status)).toEqual(Array(4).fill('succeeded'))
    expect(x.f.calls).toBe(4)
  })
})
