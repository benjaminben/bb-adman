import { describe, it, expect, afterEach } from 'vitest'
import { gate, makeRunnerFixture, waitFor, type RunnerFixture } from './runner-fixture'
import { ProviderCancelled, ProviderFailure } from '@/main/providers/types'

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

async function failedJob(x: RunnerFixture, provider = 'fake'): Promise<string> {
  x.f.body = async () => {
    throw new ProviderFailure({ kind: 'timeout', detail: 'slow' })
  }
  const id = await x.start({ provider })
  await waitFor(done(x, id))
  x.f.body = async () => ({ done: true })
  return id
}

describe('job.retry [SPEC 4.2, FR-069]', () => {
  it('makes a new job from the old request and place, and leaves the old row', async () => {
    const x = fixture()
    const old = await failedJob(x)
    const r = await x.user('job.retry', { projectId: x.projectId, jobId: old })
    if (!r.ok) throw new Error('retry failed')
    const { jobId } = r.data as { jobId: string }
    expect(jobId).not.toBe(old)
    await waitFor(done(x, jobId))
    expect(x.row(jobId)).toMatchObject({
      status: 'succeeded',
      kind: 'image_generation',
      campaignId: 'c1',
      variantId: 'v1',
      slot: 'background',
      provider: 'fake',
      model: 'm1',
      request: { prompt: 'a cat', count: 1 },
      startedBy: 'user',
    })
    expect(x.row(old)?.status).toBe('failed')
  })

  it('refuses a job that did not fail and was not cancelled: job_wrong_state', async () => {
    const x = fixture()
    const id = await x.start()
    await waitFor(done(x, id))
    expect(await x.user('job.retry', { projectId: x.projectId, jobId: id })).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'job_wrong_state' } },
    })
  })

  it('calls the key guard again: NEEDS_KEY when the key is missing', async () => {
    const x = fixture()
    const old = await failedJob(x, 'gemini')
    expect(await x.user('job.retry', { projectId: x.projectId, jobId: old })).toMatchObject({
      ok: false,
      error: { code: 'NEEDS_KEY', details: { provider: 'gemini' } },
    })
  })

  it('NOT_FOUND for a job the project does not hold', async () => {
    const x = fixture()
    expect(await x.user('job.retry', { projectId: x.projectId, jobId: 'nope' })).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    })
  })
})

describe('job.cancel [SPEC 4.2, 6.11.2]', () => {
  it('cancels a running job of a provider that stops', async () => {
    const x = fixture()
    x.f.body = async (jc) => {
      await new Promise((r) => jc.signal.addEventListener('abort', r))
      throw new ProviderCancelled()
    }
    const id = await x.start()
    await waitFor(() => x.row(id)?.status === 'running')
    expect((await x.user('job.cancel', { projectId: x.projectId, jobId: id })).ok).toBe(true)
    await waitFor(done(x, id))
    expect(x.row(id)?.status).toBe('cancelled')
  })

  it('refuses with cancel_not_supported for a running background job of such a provider', async () => {
    const x = fixture()
    const g = gate()
    x.f.body = async () => g.promise
    const id = await x.start({ provider: 'no-cancel' })
    await waitFor(() => x.row(id)?.status === 'running')
    expect(await x.user('job.cancel', { projectId: x.projectId, jobId: id })).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'cancel_not_supported' } },
    })
    g.open()
  })

  it('refuses a finished job: job_wrong_state', async () => {
    const x = fixture()
    const id = await x.start()
    await waitFor(done(x, id))
    expect(await x.user('job.cancel', { projectId: x.projectId, jobId: id })).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'job_wrong_state' } },
    })
  })
})

describe('job.markSeen [SPEC 4.2, FR-218]', () => {
  it('sets seenAt on a succeeded job; a second time is not an error', async () => {
    const x = fixture()
    const id = await x.start()
    await waitFor(done(x, id))
    expect((await x.user('job.markSeen', { projectId: x.projectId, jobIds: [id] })).ok).toBe(true)
    const seenAt = x.row(id)?.seenAt
    expect(seenAt).toEqual(expect.any(String))
    expect((await x.user('job.markSeen', { projectId: x.projectId, jobIds: [id] })).ok).toBe(true)
    expect(x.row(id)?.seenAt).toBe(seenAt)
  })

  it('refuses a job that has not succeeded: job_wrong_state, and marks none', async () => {
    const x = fixture()
    const ok = await x.start()
    await waitFor(done(x, ok))
    const failed = await failedJob(x)
    expect(
      await x.user('job.markSeen', { projectId: x.projectId, jobIds: [ok, failed] }),
    ).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'job_wrong_state' } },
    })
    expect(x.row(ok)?.seenAt).toBeNull()
  })
})

describe('job.markSeen through the runner [SPEC 3.6 "Jobs" item 3 1.38, 14 1.38 Y3]', () => {
  const tick = () => new Promise((r) => setTimeout(r, 10))

  it('a marked job gives one job.updated whose seenAt is set', async () => {
    const x = fixture()
    const id = await x.start()
    await waitFor(done(x, id))
    const before = x.jobEvents(id).length
    expect((await x.user('job.markSeen', { projectId: x.projectId, jobIds: [id] })).ok).toBe(true)
    await tick()
    const after = x.jobEvents(id).slice(before)
    expect(after).toHaveLength(1)
    expect(after[0]?.seenAt).toEqual(expect.any(String))
    expect(after[0]).toEqual(x.row(id))
  })

  it('marking it again gives no job.updated and is not an error', async () => {
    const x = fixture()
    const id = await x.start()
    await waitFor(done(x, id))
    await x.user('job.markSeen', { projectId: x.projectId, jobIds: [id] })
    await tick()
    const before = x.jobEvents(id).length
    expect((await x.user('job.markSeen', { projectId: x.projectId, jobIds: [id] })).ok).toBe(true)
    await tick()
    expect(x.jobEvents(id)).toHaveLength(before)
  })

  it('a call naming a succeeded and a failed job is refused, marks neither, emits nothing', async () => {
    const x = fixture()
    const ok = await x.start()
    await waitFor(done(x, ok))
    const failed = await failedJob(x)
    const before = x.events.length
    const r = await x.user('job.markSeen', { projectId: x.projectId, jobIds: [ok, failed] })
    expect(r.ok).toBe(false)
    await tick()
    expect(x.row(ok)?.seenAt).toBeNull()
    expect(x.row(failed)?.seenAt).toBeNull()
    expect(x.events.slice(before).filter((e) => e.name === 'job.updated')).toHaveLength(0)
  })
})

describe('job commands and agents [SPEC 4.2, 6.11.3]', () => {
  it.each(['job.retry', 'job.markSeen'])('%s is refused to an agent', async (name) => {
    const x = fixture()
    const id = await x.start()
    await waitFor(done(x, id))
    const input = name === 'job.markSeen' ? { jobIds: [id] } : { jobId: id }
    expect(await x.agent(name, { projectId: x.projectId, ...input })).toMatchObject({
      ok: false,
      error: { code: 'AGENT_DENIED' },
    })
  })

  it("refuses the agent's job.cancel of a user's job [AR-1]", async () => {
    const x = fixture()
    const g = gate()
    x.f.body = async () => g.promise
    const id = await x.start()
    await waitFor(() => x.row(id)?.status === 'running')
    expect(await x.agent('job.cancel', { projectId: x.projectId, jobId: id })).toEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: 'Agents can cancel only runs they started.' },
    })
    g.open()
  })
})
