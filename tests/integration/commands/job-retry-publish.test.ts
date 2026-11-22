// P9-1 (spec/phases/phase-09.md "Publishing", A-226): a publish job is never tried again through
// job.retry. The user publishes again from the campaign, which runs every check afresh.
import { describe, it, expect, afterEach } from 'vitest'
import { makeRunnerFixture, type RunnerFixture } from '../jobs/runner-fixture'

let x: RunnerFixture
afterEach(() => x.cleanup())

// An ended publish row, as a failed or cancelled publish would leave it.
function endedPublish(status: 'cancelled' | 'failed', provider: string): void {
  x = makeRunnerFixture()
  x.project.db
    .prepare(
      `INSERT INTO job (id, kind, status, campaign_id, provider, model, request, paid_calls,
        started_by, created_at, updated_at)
       VALUES ('old', 'publish', ?, 'c1', ?, '', '{}', 0, 'user', 'x', 'x')`,
    )
    .run(status, provider)
}

const jobCount = () =>
  (x.project.db.prepare('SELECT COUNT(*) AS n FROM job').get() as { n: number }).n

describe('job.retry refuses a publish job [P9-1, A-226]', () => {
  it.each([
    ['failed', 'fake'],
    ['cancelled', 'fake'],
    ['failed', 'dropbox'],
    ['failed', 's3'],
  ] as const)('refuses a %s %s publish and queues nothing', async (status, provider) => {
    endedPublish(status, provider)
    const result = await x.user('job.retry', { projectId: x.projectId, jobId: 'old' })
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: 'Publish again from the campaign.',
        details: { reason: 'retry_not_offered' },
      },
    })
    expect(jobCount()).toBe(1)
  })
})
