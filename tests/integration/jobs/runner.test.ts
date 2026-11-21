import { describe, it, expect, afterEach } from 'vitest'
import { gate, makeRunnerFixture, waitFor, type RunnerFixture } from './runner-fixture'
import { readJobErrorDetail } from '../../../src/main/db/rows'
import { reportProgress } from '../../../src/main/jobs/runner'
import { ProviderFailure } from '../../../src/main/providers/types'

const fixtures: RunnerFixture[] = []
function fixture(): RunnerFixture {
  const f = makeRunnerFixture()
  fixtures.push(f)
  return f
}
afterEach(() => {
  while (fixtures.length) fixtures.pop()?.cleanup()
})

const ended = (x: RunnerFixture, id: string) => () =>
  ['succeeded', 'failed', 'cancelled'].includes(x.row(id)?.status ?? '')

describe('job runner: enqueue and run [SPEC 3.6 "Jobs", 14 slice D]', () => {
  it('inserts a queued row that says who started it, then runs it to succeeded', async () => {
    const x = fixture()
    const id = await x.start({ startedBy: 'agent' })
    await waitFor(ended(x, id))
    const statuses = x.jobEvents(id).map((r) => r.status)
    expect(statuses).toEqual(['queued', 'running', 'succeeded'])
    expect(x.row(id)).toMatchObject({
      status: 'succeeded',
      startedBy: 'agent',
      campaignId: 'c1',
      variantId: 'v1',
      slot: 'background',
      provider: 'fake',
      request: { prompt: 'a cat', count: 1 },
      result: { done: true },
      paidCalls: 0,
    })
  })

  it('starts nothing when the command that enqueued fails', async () => {
    const x = fixture()
    const r = await x.bus.execute(
      'test.enqueue',
      { projectId: x.projectId, failAfter: true },
      { actor: 'user' },
    )
    expect(r.ok).toBe(false)
    await new Promise((res) => setTimeout(res, 20))
    expect(x.project.db.prepare('SELECT count(*) AS n FROM job').get()).toEqual({ n: 0 })
    expect(x.f.calls).toBe(0)
  })

  it('runs at most three jobs per provider at once, oldest first', async () => {
    const x = fixture()
    const g = gate()
    x.f.body = async () => g.promise
    const ids: string[] = []
    for (let i = 0; i < 5; i++) ids.push(await x.start())
    await waitFor(() => x.f.calls === 3)
    expect(ids.map((id) => x.row(id)?.status)).toEqual([
      'running',
      'running',
      'running',
      'queued',
      'queued',
    ])
    expect(x.jobs.activeCount(x.projectId)).toBe(5)
    g.open()
    await waitFor(() => ids.every((id) => ended(x, id)()))
    expect(x.jobs.activeCount(x.projectId)).toBe(0)
  })

  it('a job of another provider does not wait for a full provider', async () => {
    const x = fixture()
    const g = gate()
    x.f.body = async (_jc, job) => (job.provider === 'fake' ? g.promise : 'ok')
    for (let i = 0; i < 4; i++) await x.start()
    const other = await x.start({ provider: 'paid-test' })
    await waitFor(ended(x, other))
    g.open()
  })
})

describe('job runner: paid_calls [SPEC 3.3, 6.11.1, FR-230, FR-257]', () => {
  it('adds one per call to a provider that is not local, at the moment of sending', async () => {
    const x = fixture()
    const g = gate()
    let seenWhileSending: number | undefined
    x.f.body = async (jc, job) => {
      await jc.call(async () => 1)
      await jc.call(async () => {
        seenWhileSending = x.row(job.id)?.paidCalls
        return g.promise
      })
    }
    const id = await x.start({ provider: 'paid-test' })
    await waitFor(() => seenWhileSending !== undefined)
    expect(seenWhileSending).toBe(2)
    g.open()
    await waitFor(ended(x, id))
    expect(x.row(id)).toMatchObject({ status: 'succeeded', paidCalls: 2 })
  })

  it('counts a call that failed', async () => {
    const x = fixture()
    x.f.body = async (jc) =>
      jc.call(async () => {
        throw new ProviderFailure({ kind: 'quota', detail: 'limit' })
      })
    const id = await x.start({ provider: 'paid-test' })
    await waitFor(ended(x, id))
    expect(x.row(id)).toMatchObject({ status: 'failed', paidCalls: 1 })
  })

  it('never counts a local provider such as fake', async () => {
    const x = fixture()
    x.f.body = async (jc) => {
      await jc.call(async () => 1)
      await jc.call(async () => 2)
    }
    const id = await x.start({ provider: 'fake' })
    await waitFor(ended(x, id))
    expect(x.row(id)?.paidCalls).toBe(0)
  })
})

describe('job runner: failures [SPEC 3.3, 6, 6.10.9, 6.11.1]', () => {
  it('a ProviderFailure fails the job with its kind and reason; the detail stays in main', async () => {
    const x = fixture()
    x.f.body = async (jc) =>
      jc.call(async () => {
        throw new ProviderFailure({ kind: 'other', reason: 'run_failed', detail: 'SERVER TEXT 77' })
      })
    const id = await x.start()
    await waitFor(ended(x, id))
    const row = x.row(id)
    expect(row).toMatchObject({ status: 'failed', errorKind: 'other', errorReason: 'run_failed' })
    expect(row).not.toHaveProperty('errorDetail')
    expect(readJobErrorDetail(x.project.db, id)).toBe('SERVER TEXT 77')
    expect(JSON.stringify(x.events)).not.toContain('SERVER TEXT 77')
    expect(x.logText()).toContain(id)
    expect(x.logText()).not.toContain('SERVER TEXT 77')
  })

  it('puts the missing items of a failure into the result', async () => {
    const x = fixture()
    const missing = [{ what: 'model' as const, name: 'm.safetensors' }]
    x.f.body = async () => {
      throw new ProviderFailure({ kind: 'other', reason: 'missing_items', detail: 'x', missing })
    }
    const id = await x.start()
    await waitFor(ended(x, id))
    expect(x.row(id)?.result).toEqual({ missing })
  })

  it('any other error fails the job with kind other', async () => {
    const x = fixture()
    x.f.body = async () => {
      throw new Error('a bug')
    }
    const id = await x.start()
    await waitFor(ended(x, id))
    expect(x.row(id)).toMatchObject({ status: 'failed', errorKind: 'other', errorReason: null })
  })
})

describe('job runner: progress and system commands [SPEC 6.11.1, 3.6]', () => {
  it('writes progress, and stage and queue position into the result while running', async () => {
    const x = fixture()
    const g = gate()
    x.f.body = async (jc) => {
      reportProgress(jc, { stage: 'waiting', queuePosition: 3 })
      jc.progress(0.25)
      await g.promise
      return { assetIds: ['a1'] }
    }
    const id = await x.start()
    await waitFor(() => x.row(id)?.progress === 0.25)
    expect(x.row(id)?.result).toEqual({ stage: 'waiting', queuePosition: 3 })
    g.open()
    await waitFor(ended(x, id))
    expect(x.row(id)?.result).toEqual({ assetIds: ['a1'] })
  })

  it('every job.updated carries the row as it was stored', async () => {
    const x = fixture()
    const id = await x.start()
    await waitFor(ended(x, id))
    const last = x.jobEvents(id).at(-1)
    expect(last).toEqual(x.row(id))
  })

  it('jc.system sends a command through the bus as the user', async () => {
    const x = fixture()
    let answer: unknown
    x.f.body = async (jc, job) => {
      if (job.kind !== 'image_generation') return null
      answer = await jc.system('test.enqueue', { projectId: x.projectId, kind: 'generative_fill' })
    }
    const id = await x.start()
    await waitFor(ended(x, id))
    expect(answer).toMatchObject({ ok: true })
  })
})
