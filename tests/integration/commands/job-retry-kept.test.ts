import { describe, it, expect, afterEach } from 'vitest'
import { makeRunnerFixture, type RunnerFixture } from '../jobs/runner-fixture'

let x: RunnerFixture
afterEach(() => x.cleanup())

const REQUEST = { prompt: 'A bottle', referenceAssetIds: [], count: 4, width: 1080, height: 1350 }

// An ended picture row, as a run that kept some pictures would leave it.
function endedRow(status: 'cancelled' | 'failed', result: unknown): void {
  x = makeRunnerFixture()
  x.project.db
    .prepare(
      `INSERT INTO job (id, kind, status, campaign_id, variant_id, slot, provider, model, request,
        result, paid_calls, started_by, created_at, updated_at)
       VALUES ('old', 'image_generation', ?, 'c1', 'v1', 'background', 'fake', 'm1', ?, ?,
        4, 'user', 'x', 'x')`,
    )
    .run(status, JSON.stringify(REQUEST), result === null ? null : JSON.stringify(result))
}

async function retriedRequest(): Promise<unknown> {
  const r = await x.user('job.retry', { projectId: x.projectId, jobId: 'old' })
  if (!r.ok) throw new Error(`retry failed: ${JSON.stringify(r.error)}`)
  return x.row((r.data as { jobId: string }).jobId)?.request
}

describe('job.retry asks only for the pictures not yet made [FN-4; SPEC 4.2, FR-069]', () => {
  it('a cancelled job with count 4 and two kept pictures makes a new job with count 2', async () => {
    endedRow('cancelled', { assetIds: ['a1', 'a2'], failures: {}, cancelAsked: true })
    expect(await retriedRequest()).toEqual({ ...REQUEST, count: 2 })
  })

  it('asks for at least one picture when every picture was kept', async () => {
    endedRow('cancelled', { assetIds: ['a1', 'a2', 'a3', 'a4'], failures: {} })
    expect(await retriedRequest()).toEqual({ ...REQUEST, count: 1 })
  })

  it('a failed row with no kept pictures is retried unchanged', async () => {
    endedRow('failed', null)
    expect(await retriedRequest()).toEqual(REQUEST)
  })

  it('a row whose result lists no pictures is retried unchanged', async () => {
    endedRow('cancelled', { assetIds: [], failures: {}, cancelAsked: true })
    expect(await retriedRequest()).toEqual(REQUEST)
  })
})
