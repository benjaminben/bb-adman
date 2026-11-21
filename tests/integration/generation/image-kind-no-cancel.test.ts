// FIX-E (security review of agent runs): a running picture run on a provider that cannot stop
// a sent call (cancel 'none', like Gemini) can still be stopped before its remaining paid calls
// go out, by job.cancel or by unticking the provider for an agent's run. Calls already in
// flight finish; their pictures are stored and stay counted; the job ends cancelled.
import { describe, it, expect, afterEach } from 'vitest'
import { makeKindFixture, NO_CANCEL, pngAnswer, type KindFixture } from './kind-fixture'
import { waitFor } from './generation-fixture'
import { gate, makeRunnerFixture, type RunnerFixture } from '../jobs/runner-fixture'
import { ProviderCancelled, type ImageResult } from '@/main/providers/types'

let f: KindFixture
afterEach(() => f.cleanup())

const done = (id: string) => () =>
  ['succeeded', 'failed', 'cancelled'].includes(f.job(id)?.status ?? '')

// Every call waits until the test lets it answer.
function slowCalls(count: number) {
  const release = gate()
  const answer = async (): Promise<ImageResult[]> => {
    await release.promise
    return [pngAnswer()]
  }
  f.t.answers = Array.from({ length: count }, () => answer)
  return release
}

describe('job.cancel for a running picture run on a cancel-none provider [FIX-E]', () => {
  it.each([
    ['the user cancels a run the user started', 'user'],
    ['an agent cancels a run an agent started', 'agent'],
  ] as const)('%s: the unsent pictures are never sent', async (_name, actor) => {
    f = makeKindFixture()
    f.tick(NO_CANCEL.id, true)
    const release = slowCalls(8)
    const id = await f.start({ count: 8, provider: NO_CANCEL.id }, actor)
    await waitFor(() => f.calls.length === 2)
    const send = actor === 'user' ? f.user : f.agent
    expect(await send('job.cancel', { jobId: id })).toEqual({ ok: true, data: { jobId: id } })
    await waitFor(() => (f.job(id)?.result as { cancelAsked?: boolean })?.cancelAsked === true)
    // A repeated cancel is accepted and asks nothing more, as today.
    expect((await send('job.cancel', { jobId: id })).ok).toBe(true)
    expect(f.job(id)?.status).toBe('running')
    release.open()
    await waitFor(done(id))
    const row = f.job(id)
    expect(row).toMatchObject({ status: 'cancelled', paidCalls: 2 })
    expect(f.calls).toHaveLength(2)
    expect(f.assets()).toHaveLength(2)
    expect(f.files()).toHaveLength(2)
    expect(row?.result).toEqual({
      assetIds: expect.arrayContaining(f.assets().map((a) => a.id)),
      failures: {},
      cancelAsked: true,
    })
    expect((row?.result as { assetIds: string[] }).assetIds).toHaveLength(2)
    expect(await send('job.cancel', { jobId: id })).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'job_wrong_state' } },
    })
  })

  it("refuses an agent for a user's run, and the run goes on", async () => {
    f = makeKindFixture()
    const release = slowCalls(3)
    const id = await f.start({ count: 3, provider: NO_CANCEL.id })
    await waitFor(() => f.calls.length === 2)
    expect(await f.agent('job.cancel', { jobId: id })).toEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: 'Agents can cancel only runs they started.' },
    })
    release.open()
    await waitFor(done(id))
    expect(f.job(id)).toMatchObject({ status: 'succeeded', paidCalls: 3 })
  })
})

describe("unticking the provider while an agent's picture run is going [FIX-E, AR-2]", () => {
  it('sends no further call after the untick; the job ends cancelled, the pictures kept', async () => {
    f = makeKindFixture()
    f.tick(NO_CANCEL.id, true)
    const second = gate()
    const later = gate()
    const answer = (wait: Promise<void>) => async (): Promise<ImageResult[]> => {
      await wait
      return [pngAnswer()]
    }
    // The first picture answers at once; the second waits; the rest would wait too.
    f.t.answers = [pngAnswer(), answer(second.promise), ...Array(6).fill(answer(later.promise))]
    const id = await f.start({ count: 8, provider: NO_CANCEL.id }, 'agent')
    await waitFor(() => f.calls.length === 3)
    f.tick(NO_CANCEL.id, false)
    second.open()
    later.open()
    await waitFor(done(id))
    const row = f.job(id)
    expect(row).toMatchObject({ status: 'cancelled', paidCalls: 3 })
    expect(f.calls).toHaveLength(3)
    expect(f.assets()).toHaveLength(3)
    expect((row?.result as { assetIds: string[] }).assetIds).toHaveLength(3)
  })
})

describe('the runner side of the rule [FIX-E]', () => {
  const fixtures: RunnerFixture[] = []
  afterEach(() => {
    while (fixtures.length) fixtures.pop()?.cleanup()
  })
  const ended = (x: RunnerFixture, id: string) => () =>
    ['succeeded', 'failed', 'cancelled'].includes(x.row(id)?.status ?? '')

  it('waits for the calls in flight, past the cancel wait, instead of ending outcomeUnknown', async () => {
    const x = makeRunnerFixture({ cancelWaitMs: 20 })
    fixtures.push(x)
    const inFlight = gate()
    x.f.body = async (jc) => {
      await jc.call(() => inFlight.promise)
      throw new ProviderCancelled()
    }
    const id = await x.start({ provider: NO_CANCEL.id })
    await waitFor(() => x.row(id)?.status === 'running')
    await x.jobs.cancel(x.projectId, id)
    await new Promise((r) => setTimeout(r, 80))
    expect(x.row(id)?.status).toBe('running')
    inFlight.open()
    await waitFor(ended(x, id))
    expect(x.row(id)).toMatchObject({ status: 'cancelled', result: { cancelAsked: true } })
    expect(x.row(id)?.result).not.toHaveProperty('outcomeUnknown')
  })

  it('still refuses a running video run on a cancel-none provider, with the same message', async () => {
    const x = makeRunnerFixture()
    fixtures.push(x)
    const g = gate()
    x.f.body = async () => g.promise
    const id = await x.start({ provider: NO_CANCEL.id, kind: 'video_generation' })
    await waitFor(() => x.row(id)?.status === 'running')
    expect(await x.user('job.cancel', { projectId: x.projectId, jobId: id })).toEqual({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: 'No Cancel cannot stop a request once it is sent.',
        details: { reason: 'cancel_not_supported' },
      },
    })
    g.open()
  })
})
