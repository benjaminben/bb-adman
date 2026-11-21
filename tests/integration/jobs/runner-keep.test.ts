import { describe, it, expect, afterEach } from 'vitest'
import { gate, makeRunnerFixture, waitFor, type RunnerFixture } from './runner-fixture'
import { ProviderCancelled, ProviderFailure } from '../../../src/main/providers/types'
import type { JobRunContext } from '../../../src/main/jobs/types'

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
const KEPT = { assetIds: ['a1', 'a2'] }
const aborted = (jc: JobRunContext) =>
  new Promise<void>((r) => jc.signal.addEventListener('abort', () => r()))

// Keeps KEPT and reports a stage, then waits for `then`; returns the job ID once running.
async function keptJob(
  x: RunnerFixture,
  then: (jc: JobRunContext) => Promise<unknown>,
  input: { provider?: string; kind?: 'image_generation' | 'generative_fill' } = {},
) {
  x.f.body = async (jc) => {
    jc.keep(KEPT)
    jc.onProgress({ stage: 'working', queuePosition: 2 })
    return then(jc)
  }
  const id = await x.start({ provider: 'paid-test', ...input })
  await waitFor(() => (x.row(id)?.result as { stage?: string } | null)?.stage === 'working')
  return id
}

async function ended(x: RunnerFixture, id: string) {
  await waitFor(done(x, id))
  return x.row(id)
}

describe('jc.keep and the final result [SPEC 6.11.1 1.38, 14 1.38 Y14]', () => {
  it('while running, the result holds what was kept and the progress fields', async () => {
    const x = fixture()
    const g = gate()
    const id = await keptJob(x, async () => g.promise)
    expect(x.row(id)?.result).toEqual({ ...KEPT, stage: 'working', queuePosition: 2 })
    g.open()
  })

  it('kept, then stopped by the provider: cancelled, the kept value plus cancelAsked', async () => {
    const x = fixture()
    const id = await keptJob(x, async (jc) => {
      await aborted(jc)
      throw new ProviderCancelled()
    })
    await x.jobs.cancel(x.projectId, id)
    expect(await ended(x, id)).toMatchObject({ status: 'cancelled' })
    expect(x.row(id)?.result).toEqual({ ...KEPT, cancelAsked: true })
  })

  it('kept, then an attached cancel: cancelled, the kept value alone', async () => {
    const x = fixture()
    const g = gate()
    const id = await keptJob(x, async () => g.promise, { kind: 'generative_fill' })
    await x.jobs.cancel(x.projectId, id)
    expect(await ended(x, id)).toMatchObject({ status: 'cancelled', result: KEPT })
    expect(x.row(id)?.result).toEqual(KEPT)
    g.open()
  })

  it('kept, then no confirmation: cancelled, the kept value plus cancelAsked and outcomeUnknown', async () => {
    const x = fixture()
    const g = gate()
    const id = await keptJob(x, async () => g.promise)
    await x.jobs.cancel(x.projectId, id)
    expect((await ended(x, id))?.result).toEqual({
      ...KEPT,
      cancelAsked: true,
      outcomeUnknown: true,
    })
    g.open()
  })

  it('kept, then a ProviderFailure with missing: failed, the kept value plus missing', async () => {
    const x = fixture()
    const missing = [{ what: 'model' as const, name: 'm.safetensors' }]
    const id = await keptJob(x, async () => {
      await new Promise((r) => setTimeout(r, 20))
      throw new ProviderFailure({ kind: 'other', reason: 'missing_items', detail: 'x', missing })
    })
    const row = await ended(x, id)
    expect(row?.status).toBe('failed')
    expect(row?.result).toEqual({ ...KEPT, missing })
  })

  it('kept, then a ProviderFailure after a stop was asked: failed, the kept value plus cancelAsked', async () => {
    const x = fixture()
    const id = await keptJob(x, async (jc) => {
      await aborted(jc)
      throw new ProviderFailure({ kind: 'timeout', detail: 'slow' })
    })
    await x.jobs.cancel(x.projectId, id)
    const row = await ended(x, id)
    expect(row).toMatchObject({ status: 'failed', errorKind: 'timeout' })
    expect(row?.result).toEqual({ ...KEPT, cancelAsked: true })
  })

  it('kept, then success: the result is the returned value only', async () => {
    const x = fixture()
    const id = await keptJob(x, async () => {
      await new Promise((r) => setTimeout(r, 20))
      return { assetIds: ['a1', 'a2', 'a3'] }
    })
    const row = await ended(x, id)
    expect(row?.status).toBe('succeeded')
    expect(row?.result).toEqual({ assetIds: ['a1', 'a2', 'a3'] })
  })

  it('a kept outcomeUnknown: false does not hide the runner true', async () => {
    const x = fixture()
    const g = gate()
    x.f.body = async (jc) => {
      jc.keep({ outcomeUnknown: false, stage: 'mine' })
      return g.promise
    }
    const id = await x.start({ provider: 'paid-test' })
    await waitFor(() => x.row(id)?.status === 'running')
    await x.jobs.cancel(x.projectId, id)
    expect((await ended(x, id))?.result).toEqual({ cancelAsked: true, outcomeUnknown: true })
    g.open()
  })
})

describe('no stage or queue position in an ended row [SPEC 6.11.1 1.38, 14 1.38 Y14]', () => {
  const noProgress = (x: RunnerFixture, id: string) => {
    const result = (x.row(id)?.result ?? {}) as Record<string, unknown>
    expect(result).not.toHaveProperty('stage')
    expect(result).not.toHaveProperty('queuePosition')
  }

  it.each(['stop', 'attached', 'wait', 'fail', 'succeed'])('after the end "%s"', async (how) => {
    const x = fixture()
    const go = gate()
    const kind = how === 'attached' ? 'generative_fill' : 'image_generation'
    const id = await keptJob(
      x,
      async (jc) => {
        if (how === 'stop') {
          await aborted(jc)
          throw new ProviderCancelled()
        }
        await go.promise
        if (how === 'fail') throw new ProviderFailure({ kind: 'other', detail: 'x' })
        return { assetIds: [] }
      },
      { kind },
    )
    if (how === 'fail' || how === 'succeed') go.open()
    else await x.jobs.cancel(x.projectId, id)
    await waitFor(done(x, id))
    noProgress(x, id)
    go.open()
  })
})

describe('jc.cancelled() [SPEC 6.11.1 1.38, review O-7]', () => {
  it('is false while running, true once a stop was asked, true after the end', async () => {
    const x = fixture()
    const g = gate()
    let held: JobRunContext | undefined
    x.f.body = async (jc) => {
      held = jc
      return g.promise
    }
    const id = await x.start({ provider: 'paid-test' })
    await waitFor(() => held !== undefined)
    expect(held?.cancelled()).toBe(false)
    await x.jobs.cancel(x.projectId, id)
    expect(x.row(id)?.status).toBe('running')
    expect(held?.cancelled()).toBe(true)
    await waitFor(done(x, id))
    expect(held?.cancelled()).toBe(true)
    g.open()
  })
})
