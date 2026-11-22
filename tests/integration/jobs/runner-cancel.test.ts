import { describe, it, expect, afterEach } from 'vitest'
import { gate, makeRunnerFixture, waitFor, type RunnerFixture } from './runner-fixture'
import { runOptions } from '@/main/jobs/runner'
import { fakeImage } from '@/main/providers/fake/image'
import {
  resetFakeBehaviour,
  setFakeBehaviour,
  type FakeCancel,
} from '@/main/providers/fake/behaviour'
import { AppError } from '@/shared/schemas/result'

const fixtures: RunnerFixture[] = []
function fixture(): RunnerFixture {
  const f = makeRunnerFixture({ cancelWaitMs: 60 })
  fixtures.push(f)
  return f
}
afterEach(() => {
  resetFakeBehaviour()
  while (fixtures.length) fixtures.pop()?.cleanup()
})

const input = { prompt: 'p', references: [], width: 8, height: 8, count: 1 }
const done = (x: RunnerFixture, id: string) => () =>
  ['succeeded', 'failed', 'cancelled'].includes(x.row(id)?.status ?? '')

// A picture job on the fake that waits long enough to be cancelled.
async function runningFake(x: RunnerFixture, onCancel: FakeCancel, provider = 'fake') {
  setFakeBehaviour({ waitMs: 5_000, onCancel })
  x.f.body = async (jc) => {
    const results = await jc.call(() => fakeImage().generate(input, runOptions(jc)))
    return { pictures: results.length }
  }
  const id = await x.start({ provider })
  await waitFor(() => x.row(id)?.status === 'running')
  return id
}

describe('job.cancel in the runner [SPEC 6.11.2, FR-281]', () => {
  it('cancels a queued job at once; it never runs', async () => {
    const x = fixture()
    const g = gate()
    x.f.body = async () => g.promise
    for (let i = 0; i < 3; i++) await x.start()
    const queued = await x.start()
    await x.jobs.cancel(x.projectId, queued)
    expect(x.row(queued)?.status).toBe('cancelled')
    g.open()
    await new Promise((r) => setTimeout(r, 20))
    expect(x.f.calls).toBe(3)
  })

  it('provider stops: says "Stopping" first, fires the signal, ends cancelled', async () => {
    const x = fixture()
    const id = await runningFake(x, 'stop')
    await x.jobs.cancel(x.projectId, id)
    await waitFor(done(x, id))
    expect(
      x.jobEvents(id).some((r) => (r.result as { cancelAsked?: boolean } | null)?.cancelAsked),
    ).toBe(true)
    expect(x.row(id)?.status).toBe('cancelled')
  })

  it('provider finished anyway: succeeded, with finishedAfterCancel and the result', async () => {
    const x = fixture()
    const id = await runningFake(x, 'finish')
    await x.jobs.cancel(x.projectId, id)
    await waitFor(done(x, id))
    expect(x.row(id)).toMatchObject({
      status: 'succeeded',
      result: { pictures: 1, finishedAfterCancel: true },
    })
  })

  it('provider does not confirm in its wait: cancelled with outcomeUnknown', async () => {
    const x = fixture()
    const id = await runningFake(x, 'no_confirm')
    await x.jobs.cancel(x.projectId, id)
    await waitFor(done(x, id))
    expect(x.row(id)).toMatchObject({
      status: 'cancelled',
      result: { cancelAsked: true, outcomeUnknown: true },
    })
  })

  it('keeps the count of calls already sent', async () => {
    const x = fixture()
    const id = await runningFake(x, 'stop', 'paid-test')
    await x.jobs.cancel(x.projectId, id)
    await waitFor(done(x, id))
    expect(x.row(id)?.paidCalls).toBe(1)
  })

  it('refuses a running background job whose provider cannot stop: cancel_not_supported', async () => {
    const x = fixture()
    const g = gate()
    x.f.body = async () => g.promise
    const id = await x.start({ provider: 'no-cancel', kind: 'video_generation' })
    await waitFor(() => x.row(id)?.status === 'running')
    const error = await x.jobs.cancel(x.projectId, id).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AppError)
    expect((error as AppError).toBody()).toMatchObject({
      code: 'RULE_VIOLATION',
      message: 'No Cancel · m1 cannot stop a request once it is sent.',
      details: { reason: 'cancel_not_supported' },
    })
    expect(x.row(id)?.status).toBe('running')
    g.open()
  })

  it('an attached job stops waiting at once, whatever the provider; nothing is applied', async () => {
    const x = fixture()
    const g = gate()
    let sent: unknown = 'not tried'
    x.f.body = async (jc) => {
      await g.promise
      sent = await jc.system('test.enqueue', { projectId: x.projectId }).catch(() => 'refused')
      return { applied: true }
    }
    const id = await x.start({ provider: 'no-cancel', kind: 'generative_fill' })
    await waitFor(() => x.row(id)?.status === 'running')
    await x.jobs.cancel(x.projectId, id)
    expect(x.row(id)?.status).toBe('cancelled')
    g.open()
    await waitFor(() => sent !== 'not tried')
    expect(sent).toBe('refused')
    expect(x.row(id)?.status).toBe('cancelled')
  })

  it('refuses a job that has ended: job_wrong_state', async () => {
    const x = fixture()
    const id = await x.start()
    await waitFor(done(x, id))
    const error = await x.jobs.cancel(x.projectId, id).catch((e: unknown) => e)
    expect((error as AppError).toBody()).toMatchObject({
      code: 'RULE_VIOLATION',
      details: { reason: 'job_wrong_state' },
    })
  })
})

describe('cancelAll, for project.close [SPEC 3.6 "Jobs" item 6]', () => {
  it('ends every queued and running job and fires their signals', async () => {
    const x = fixture()
    setFakeBehaviour({ waitMs: 5_000, onCancel: 'no_confirm' })
    let aborted = 0
    x.f.body = async (jc) => {
      jc.signal.addEventListener('abort', () => aborted++)
      return jc.call(() => fakeImage().generate(input, runOptions(jc)))
    }
    const ids: string[] = []
    for (let i = 0; i < 4; i++)
      ids.push(await x.start({ provider: i === 0 ? 'no-cancel' : 'fake' }))
    await waitFor(() => x.f.calls === 4)
    const queued = await x.start()
    await x.jobs.cancelAll(x.projectId)
    expect([...ids, queued].map((id) => x.row(id)?.status)).toEqual(Array(5).fill('cancelled'))
    expect(aborted).toBe(4)
    expect(x.jobs.activeCount(x.projectId)).toBe(0)
  })
})
