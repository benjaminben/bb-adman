import { describe, it, expect, afterEach } from 'vitest'
import { gate, makeRunnerFixture, waitFor, type RunnerFixture } from './runner-fixture'
import { ProviderFailure } from '@/main/providers/types'
import type { JobRow } from '@/shared/schemas/rows/job'

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

function place(x: RunnerFixture, id: string, campaignId: string, variantId: string) {
  x.project.db
    .prepare('UPDATE job SET campaign_id = ?, variant_id = ?, layer_id = ? WHERE id = ?')
    .run(campaignId, variantId, `${variantId}-layer`, id)
}

async function list(x: RunnerFixture, input: Record<string, unknown> = {}) {
  return ((await x.list(input)) as JobRow[]).map((r) => r.id)
}

describe('job.list [SPEC 4.3, FR-152, FR-217]', () => {
  it('lists wire rows newest first, filtered by place and state, up to the limit', async () => {
    const x = fixture()
    const a = await x.start()
    await waitFor(done(x, a))
    x.f.body = async () => {
      throw new ProviderFailure({ kind: 'other', detail: 'DETAIL TEXT' })
    }
    const b = await x.start()
    await waitFor(done(x, b))
    const g = gate()
    x.f.body = async () => g.promise
    const c = await x.start()
    await waitFor(() => x.row(c)?.status === 'running')
    place(x, b, 'c2', 'v2')

    expect(await list(x)).toEqual([c, b, a])
    expect(await list(x, { limit: 2 })).toEqual([c, b])
    expect(await list(x, { state: 'active' })).toEqual([c])
    expect(await list(x, { state: 'unseen' })).toEqual([a])
    expect(await list(x, { state: 'failed' })).toEqual([b])
    expect(await list(x, { campaignId: 'c2' })).toEqual([b])
    expect(await list(x, { variantId: 'v1' })).toEqual([c, a])
    expect(await list(x, { layerId: 'v2-layer' })).toEqual([b])
    const rows = (await x.list()) as JobRow[]
    expect(rows[1]).not.toHaveProperty('errorDetail')
    expect(JSON.stringify(rows)).not.toContain('DETAIL TEXT')
    g.open()
  })

  it('refuses input that is not valid', async () => {
    const x = fixture()
    await expect(x.list({ state: 'all' })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
})

describe('project.close with jobs [SPEC 3.6 "Jobs" item 6, 4.1 jobs_running]', () => {
  it('refuses while a job is queued or running, with the count', async () => {
    const x = fixture()
    const g = gate()
    x.f.body = async () => g.promise
    await x.start()
    await x.start()
    expect(await x.user('project.close', { projectId: x.projectId })).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'jobs_running', count: 2 } },
    })
    g.open()
  })

  it("with runningJobs 'stop' cancels the jobs first, then closes", async () => {
    const x = fixture()
    const g = gate()
    x.f.body = async () => g.promise
    const id = await x.start()
    await waitFor(() => x.row(id)?.status === 'running')
    const r = await x.user('project.close', { projectId: x.projectId, runningJobs: 'stop' })
    expect(r.ok).toBe(true)
    expect(x.jobEvents(id).at(-1)?.status).toBe('cancelled')
    g.open()
  })

  it('closes at once when no job is active', async () => {
    const x = fixture()
    const id = await x.start()
    await waitFor(done(x, id))
    expect((await x.user('project.close', { projectId: x.projectId })).ok).toBe(true)
  })
})
