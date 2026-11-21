import { describe, it, expect, afterEach } from 'vitest'
import { gate, makeRunnerFixture, waitFor, type RunnerFixture } from './runner-fixture'
import type { JobRunContext } from '@/main/jobs/types'

const fixtures: RunnerFixture[] = []
function fixture(): RunnerFixture {
  const f = makeRunnerFixture({ cancelWaitMs: 60 })
  fixtures.push(f)
  return f
}
afterEach(() => {
  while (fixtures.length) fixtures.pop()?.cleanup()
})

const done = (x: RunnerFixture, id: string) => () =>
  ['succeeded', 'failed', 'cancelled'].includes(x.row(id)?.status ?? '')

describe('jc.setRemoteJobId [SPEC 6.11.1 1.38, 14 1.38 Y5]', () => {
  it('stores the ID in the row, and the last job.updated carries it', async () => {
    const x = fixture()
    const g = gate()
    x.f.body = async (jc) => {
      jc.setRemoteJobId('remote-7')
      await g.promise
      return { done: true }
    }
    const id = await x.start({ kind: 'video_generation' })
    await waitFor(() => x.row(id)?.remoteJobId === 'remote-7')
    expect(x.jobEvents(id).at(-1)?.remoteJobId).toBe('remote-7')
    g.open()
    await waitFor(done(x, id))
    expect(x.row(id)?.remoteJobId).toBe('remote-7')
  })

  it('writes nothing once the job has ended', async () => {
    const x = fixture()
    let held: JobRunContext | undefined
    x.f.body = async (jc) => {
      held = jc
      return { done: true }
    }
    const id = await x.start({ kind: 'video_generation' })
    await waitFor(done(x, id))
    const events = x.jobEvents(id).length
    held?.setRemoteJobId('too-late')
    expect(x.row(id)?.remoteJobId).toBeNull()
    expect(x.jobEvents(id)).toHaveLength(events)
  })
})

const ENDED = ['succeeded', 'failed', 'cancelled']

describe('jc.call and late cancels [SPEC 14 1.38 Y17, review O-2, O-10]', () => {
  it('when the project is no longer open, call throws and never runs its function', async () => {
    const x = fixture()
    const g = gate()
    let ran = false
    let thrown: unknown
    x.f.body = async (jc) => {
      await g.promise
      await jc.call(async () => (ran = true)).catch((e: unknown) => (thrown = e))
    }
    await x.start({ provider: 'paid-test' })
    await waitFor(() => x.f.calls === 1)
    x.projects.remove(x.projectId)
    g.open()
    await waitFor(() => thrown !== undefined)
    x.projects.add(x.project)
    expect(ran).toBe(false)
    expect((thrown as Error).name).toBe('ProviderCancelled')
  })

  it('two job.cancel calls on one running job give one outcomeUnknown end and no error', async () => {
    const x = fixture()
    const g = gate()
    x.f.body = async () => g.promise
    const id = await x.start({ provider: 'paid-test' })
    await waitFor(() => x.row(id)?.status === 'running')
    const a = await x.user('job.cancel', { projectId: x.projectId, jobId: id })
    const b = await x.user('job.cancel', { projectId: x.projectId, jobId: id })
    expect([a.ok, b.ok]).toEqual([true, true])
    await waitFor(done(x, id))
    await new Promise((r) => setTimeout(r, 100))
    const ends = x.jobEvents(id).filter((r) => ENDED.includes(r.status))
    expect(ends).toHaveLength(1)
    expect(ends[0]).toMatchObject({ status: 'cancelled', result: { outcomeUnknown: true } })
    expect(x.logText()).not.toContain('could not be cancelled')
    g.open()
  })

  it('call after a stop was asked throws and adds nothing to paid_calls', async () => {
    const x = fixture()
    const g = gate()
    let thrown: unknown
    x.f.body = async (jc) => {
      await g.promise
      await jc.call(async () => 1).catch((e: unknown) => (thrown = e))
    }
    const id = await x.start({ provider: 'paid-test' })
    await waitFor(() => x.row(id)?.status === 'running')
    await x.jobs.cancel(x.projectId, id)
    g.open()
    await waitFor(() => thrown !== undefined)
    expect((thrown as Error).name).toBe('ProviderCancelled')
    expect(x.row(id)?.paidCalls).toBe(0)
  })

  it('a cancel in the same tick as the handler return leaves one final row and no write after', async () => {
    const x = fixture()
    const g = gate()
    x.f.body = async () => {
      await g.promise
      return { done: true }
    }
    const id = await x.start({ provider: 'paid-test' })
    await waitFor(() => x.row(id)?.status === 'running')
    g.open()
    const cancelled = x.jobs.cancel(x.projectId, id).catch(() => 'ended first')
    await cancelled
    await waitFor(done(x, id))
    await new Promise((r) => setTimeout(r, 100))
    const events = x.jobEvents(id)
    const ends = events.filter((r) => ENDED.includes(r.status))
    expect(ends).toHaveLength(1)
    expect(['succeeded', 'cancelled']).toContain(ends[0]?.status)
    expect(events.at(-1)).toEqual(ends[0])
    expect(x.row(id)).toEqual(ends[0])
  })
})
