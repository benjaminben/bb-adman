import { describe, it, expect, afterEach } from 'vitest'
import { makeKindFixture, pngAnswer, type Answer, type KindFixture } from './kind-fixture'
import { waitFor } from './generation-fixture'
import { ProviderCancelled, type RunOptions } from '@/main/providers/types'

let f: KindFixture
afterEach(() => f.cleanup())

const done = (id: string) => () =>
  ['succeeded', 'failed', 'cancelled'].includes(f.job(id)?.status ?? '')

function aborted(opts?: RunOptions): Promise<void> {
  return new Promise((resolve) => {
    if (opts?.signal?.aborted) return resolve()
    opts?.signal?.addEventListener('abort', () => resolve())
  })
}

// Waits for the stop, then confirms it.
const stopsOnCancel: Answer = async (_input, opts) => {
  await aborted(opts)
  throw new ProviderCancelled()
}
// Waits for the stop, then sends a picture anyway.
const finishesAnyway: Answer = async (_input, opts) => {
  await aborted(opts)
  return [pngAnswer()]
}

describe('a stopped image job keeps what arrived [SPEC 6.11.1 handler rule, 6.11.2; FR-267, FR-281]', () => {
  it('ends cancelled, keeps the two stored pictures in result, and sends no call after the stop', async () => {
    f = makeKindFixture()
    f.t.answers = [pngAnswer(), pngAnswer(), stopsOnCancel, stopsOnCancel]
    const id = await f.start({ count: 5 })
    await waitFor(() => f.assets().length === 2 && f.calls.length === 4)
    expect((await f.user('job.cancel', { jobId: id })).ok).toBe(true)
    await waitFor(done(id))
    const row = f.job(id)
    expect(row?.status).toBe('cancelled')
    expect(row?.paidCalls).toBe(4)
    expect(f.calls).toHaveLength(4)
    const ids = f.assets().map((a) => a.id)
    expect(row?.result).toMatchObject({ assetIds: expect.arrayContaining(ids), cancelAsked: true })
    expect((row?.result as { assetIds: string[] }).assetIds).toHaveLength(2)
    expect(f.files()).toHaveLength(2)
  })

  it('stores a picture that arrives after the stop and ends succeeded with finishedAfterCancel [FN-3]', async () => {
    f = makeKindFixture()
    f.t.answers = [finishesAnyway]
    const id = await f.start({ count: 1 })
    await waitFor(() => f.calls.length === 1)
    await f.user('job.cancel', { jobId: id })
    await waitFor(done(id))
    const row = f.job(id)
    expect(row?.status).toBe('succeeded')
    expect(row?.result).toMatchObject({ finishedAfterCancel: true })
    expect(f.assets()).toHaveLength(1)
    expect((row?.result as { assetIds: string[] }).assetIds).toEqual([f.assets()[0]?.id])
    expect(f.files()).toHaveLength(1)
  })

  it('stores the two pictures already asked for and sends none of the others [FN-3]', async () => {
    f = makeKindFixture()
    f.t.answers = [finishesAnyway, finishesAnyway]
    const id = await f.start({ count: 4 })
    await waitFor(() => f.calls.length === 2)
    await f.user('job.cancel', { jobId: id })
    await waitFor(done(id))
    const row = f.job(id)
    expect(row?.status).toBe('cancelled')
    expect(row?.paidCalls).toBe(2)
    expect(f.calls).toHaveLength(2)
    expect(f.assets()).toHaveLength(2)
    expect((row?.result as { assetIds: string[] }).assetIds).toHaveLength(2)
    expect(f.files()).toHaveLength(2)
  })
})
