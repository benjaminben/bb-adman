// P9-10 (spec/phases/phase-09.md "Publishing"; security class full): the job publishes only what
// publish.run planned in this process, checks the replace confirmation against the files in the
// campaign folder when it starts, and reads the old manifest's project again before it writes
// its own and cleans up. Local storage on a temporary folder; nothing reaches a bucket or Dropbox.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { publishKind } from '@/main/jobs/kinds/publish'
import type { JobRunContext } from '@/main/jobs/types'
import { ProviderFailure } from '@/main/providers/types'
import { publishPlans, type PublishPlan } from '@/main/publish/publish-plans'
import type { JobRow } from '@/shared/schemas/rows/job'
import { PNG } from '../../helpers/fake-publish-export'
import { CAMPAIGN } from './component-project'
import { id } from './inspect-setup'
import { jobSetUp, type JobSetUp } from './publish-job-setup'

const JOB_ID = '01JD00000000000000000000JB'

let s: JobSetUp | undefined
afterEach(() => {
  s?.cleanup()
  s = undefined
})

function contextOf(x: JobSetUp): JobRunContext {
  const controller = new AbortController()
  return {
    deps: x.fx.core.deps,
    projectId: x.projectId,
    signal: controller.signal,
    cancelled: () => false,
    progress: () => undefined,
  } as unknown as JobRunContext
}

const jobOf = (over: Partial<JobRow> = {}) =>
  ({ id: JOB_ID, kind: 'publish', campaignId: CAMPAIGN, provider: 'fake', ...over }) as JobRow

const planOf = (x: JobSetUp, over: Partial<PublishPlan> = {}): PublishPlan => ({
  projectId: x.projectId,
  campaignId: CAMPAIGN,
  storage: 'fake',
  replaceConfirmed: true,
  proceedDespiteWarnings: false,
  proceedReason: null,
  ...over,
})

const failureOf = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: unknown) => e,
  )

describe('the publish job, its plan [P9-10]', () => {
  it('fails a row with no plan, or one that does not match it, touching nothing', async () => {
    const x = await jobSetUp()
    s = x
    const run = (job: JobRow) => publishKind().run(contextOf(x), job)
    const rows = [jobOf(), jobOf({ provider: 's3' }), jobOf({ campaignId: 'other-camp-zz2345' })]
    for (const [n, job] of rows.entries()) {
      if (n > 0) publishPlans(x.fx.core.deps).set(JOB_ID, planOf(x))
      const error = await failureOf(run(job))
      expect(error).toBeInstanceOf(ProviderFailure)
      expect((error as ProviderFailure).error).toEqual({
        kind: 'other',
        detail: 'publish_not_started_here',
      })
    }
    expect(x.fake.inputs).toEqual([])
    expect(x.workChildren()).toEqual([])
    expect(x.storageFiles()).toEqual({})
  })

  it('ends before the export when files are there and the plan has no replace confirmation', async () => {
    const x = await jobSetUp()
    s = x
    x.plant(`${CAMPAIGN}/report.html`, 'old report')
    publishPlans(x.fx.core.deps).set(JOB_ID, planOf(x, { replaceConfirmed: false }))
    const error = await failureOf(publishKind().run(contextOf(x), jobOf()))
    expect((error as ProviderFailure).error).toEqual({
      kind: 'other',
      detail: 'publish_replace_not_confirmed_failed',
    })
    expect(x.fake.inputs).toEqual([])
    expect(Object.keys(x.storageFiles())).toEqual([`${CAMPAIGN}/report.html`])
  })

  it('writes no manifest and removes nothing when another project published meanwhile', async () => {
    const x = await jobSetUp()
    s = x
    x.plant(`${CAMPAIGN}/stale.png`, PNG)
    const theirs = JSON.stringify({
      format: 1,
      appVersion: '0.1.0',
      projectId: id(77),
      campaignId: CAMPAIGN,
      publishNumber: 9,
      publishedAt: '2026-11-20T10:30:00.000Z',
      files: [],
    })
    x.fake.after = () => x.plant(`${CAMPAIGN}/manifest.json`, theirs)
    const job = await x.publish()
    expect(job.status).toBe('failed')
    expect(x.hidden(job.id).error_detail).toBe('publish_folder_changed_failed')
    const folder = path.join(x.storageRoot, CAMPAIGN)
    expect(fs.readFileSync(path.join(folder, 'manifest.json'), 'utf8')).toBe(theirs)
    expect(fs.existsSync(path.join(folder, 'stale.png'))).toBe(true)
  })
})
