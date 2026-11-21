import { describe, it, expect, afterEach } from 'vitest'
import { gate, makeRunnerFixture, waitFor, type RunnerFixture } from './runner-fixture'
import { runOptions } from '../../../src/main/jobs/runner'
import { fakeImage } from '../../../src/main/providers/fake/image'
import {
  resetFakeBehaviour,
  setFakeBehaviour,
  type FakeCancel,
} from '../../../src/main/providers/fake/behaviour'
import { openProjectFile, closeProjectFile } from '../../../src/main/db/project-file'
import { readWireRow } from '../../../src/main/db/rows'
import type { JobRow } from '../../../src/shared/schemas/rows/job'

const fixtures: RunnerFixture[] = []
function fixture(closeWaitMs = 300): RunnerFixture {
  const f = makeRunnerFixture({ cancelWaitMs: 10_000, closeWaitMs })
  fixtures.push(f)
  return f
}
afterEach(() => {
  resetFakeBehaviour()
  while (fixtures.length) fixtures.pop()?.cleanup()
})

const input = { prompt: 'p', references: [], width: 8, height: 8, count: 1 }
const close = (x: RunnerFixture) =>
  x.user('project.close', { projectId: x.projectId, runningJobs: 'stop' })
// The row as the last job.updated gave it: after a close the file is shut.
const last = (x: RunnerFixture, id: string) => x.jobEvents(id).at(-1)

async function running(x: RunnerFixture, opts: Parameters<RunnerFixture['start']>[0] = {}) {
  const id = await x.start(opts)
  await waitFor(() => x.row(id)?.status === 'running')
  return id
}

// A picture job on the fake provider that waits long enough to be closed on.
async function runningFake(x: RunnerFixture, onCancel: FakeCancel, provider = 'fake') {
  setFakeBehaviour({ waitMs: 5_000, onCancel })
  x.f.body = async (jc) => {
    const results = await jc.call(() => fakeImage().generate(input, runOptions(jc)))
    return { pictures: results.length }
  }
  return running(x, { provider })
}

describe("project.close with runningJobs 'stop' [SPEC 6.11.2 'Closing a project' 1.38, 14 1.38 Y7]", () => {
  it('a queued job ends cancelled with no flag', async () => {
    const x = fixture()
    const g = gate()
    x.f.body = async () => g.promise
    for (let i = 0; i < 3; i++) await running(x, { provider: 'no-cancel' })
    const queued = await x.start({ provider: 'no-cancel' })
    expect((await close(x)).ok).toBe(true)
    expect(last(x, queued)).toMatchObject({ status: 'cancelled', result: null })
    g.open()
  })

  it('a running attached job ends cancelled with no flag', async () => {
    const x = fixture()
    const g = gate()
    x.f.body = async () => g.promise
    const id = await running(x, { kind: 'generative_fill' })
    expect((await close(x)).ok).toBe(true)
    expect(last(x, id)).toMatchObject({ status: 'cancelled', result: null })
    g.open()
  })

  it('a running job of a provider that cannot stop ends cancelled with stoppedWaiting', async () => {
    const x = fixture()
    const g = gate()
    x.f.body = async () => g.promise
    const id = await running(x, { provider: 'no-cancel' })
    expect((await close(x)).ok).toBe(true)
    expect(last(x, id)).toMatchObject({ status: 'cancelled', result: { stoppedWaiting: true } })
    expect(last(x, id)?.result).not.toHaveProperty('cancelAsked')
    expect(last(x, id)?.result).not.toHaveProperty('outcomeUnknown')
  })

  it('a fake job told to stop ends cancelled, and the close returns well before the wait', async () => {
    const x = fixture(2_000)
    const id = await runningFake(x, 'stop')
    const t0 = Date.now()
    expect((await close(x)).ok).toBe(true)
    expect(Date.now() - t0).toBeLessThan(1_000)
    expect(last(x, id)?.status).toBe('cancelled')
    expect(last(x, id)?.result).not.toHaveProperty('outcomeUnknown')
  })

  it('a fake job told to finish anyway ends succeeded with finishedAfterCancel', async () => {
    const x = fixture()
    const id = await runningFake(x, 'finish')
    expect((await close(x)).ok).toBe(true)
    expect(last(x, id)).toMatchObject({
      status: 'succeeded',
      result: { pictures: 1, finishedAfterCancel: true },
    })
  })

  it('a fake job that does not confirm ends cancelled with outcomeUnknown after the wait', async () => {
    const x = fixture(150)
    const id = await runningFake(x, 'no_confirm')
    const t0 = Date.now()
    expect((await close(x)).ok).toBe(true)
    expect(Date.now() - t0).toBeGreaterThanOrEqual(140)
    expect(last(x, id)).toMatchObject({
      status: 'cancelled',
      result: { cancelAsked: true, outcomeUnknown: true },
    })
  })

  it('a job enqueued during the wait is cancelled when the close returns', async () => {
    const x = fixture(200)
    await runningFake(x, 'no_confirm')
    const closing = close(x)
    await new Promise((r) => setTimeout(r, 30))
    const late = await x.start({ provider: 'no-cancel' })
    expect((await closing).ok).toBe(true)
    expect(last(x, late)?.status).toBe('cancelled')
  })

  it('paid_calls of a paid-test job is the same before and after the close', async () => {
    const x = fixture()
    const id = await runningFake(x, 'no_confirm', 'paid-test')
    const before = x.row(id)?.paidCalls
    expect(before).toBe(1)
    expect((await close(x)).ok).toBe(true)
    expect(last(x, id)?.paidCalls).toBe(before)
  })
})

describe('a closing project starts no job [SPEC 6.11.2 1.40, 14 1.40 AA2]', () => {
  it('a paid-test job enqueued during the wait is never started', async () => {
    const x = fixture(200)
    await runningFake(x, 'no_confirm')
    const closing = close(x)
    await new Promise((r) => setTimeout(r, 30))
    const late = await x.start({ provider: 'paid-test' })
    expect((await closing).ok).toBe(true)
    expect(last(x, late)).toMatchObject({ status: 'cancelled', paidCalls: 0 })
    expect(last(x, late)?.result ?? {}).not.toHaveProperty('outcomeUnknown')
    expect(last(x, late)?.result ?? {}).not.toHaveProperty('stoppedWaiting')
    expect(x.f.calls).toBe(1)
  })

  it('a close that returned leaves the file free to run jobs when opened again', async () => {
    const x = fixture()
    expect((await close(x)).ok).toBe(true)
    const again = openProjectFile({ filePath: x.project.filePath, appVersion: '0.1.0' })
    x.projects.add(again)
    try {
      await x.jobs.projectOpened(again.projectId)
      const id = await x.start()
      const stored = () => readWireRow(again.db, 'job', { id }) as JobRow | null
      await waitFor(() => stored()?.status === 'succeeded')
    } finally {
      x.projects.remove(again.projectId)
      closeProjectFile(again)
    }
  })
})
