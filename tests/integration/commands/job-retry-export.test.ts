// P8-5 (spec/phases/phase-08.md "The output folder (security)"): an export row holds no path,
// so job.retry cannot rebuild its plan. It refuses kind export with export_not_retried before
// anything is queued; the user runs the export again from the Export dialog.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeFixture, type Fixture } from '../core-fixture'
import { openCheckProject } from '../checks/check-fixture'
import { insertJob } from '../queries/job-row-fixture'
import { readWireRows } from '@/main/db/rows'

let f: Fixture | undefined
afterEach(() => {
  f?.cleanup()
  f = undefined
  vi.restoreAllMocks()
})

const REQUEST = {
  variantIds: ['V1'],
  imageFormat: 'png',
  jpgQuality: 90,
  fps: 30,
  proceedDespiteWarnings: false,
}

describe('job.retry of an export row [P8-5, A-195]', () => {
  it.each(['failed', 'cancelled'])('refuses a %s export row and queues nothing', async (status) => {
    const fx = makeFixture()
    f = fx
    const p = await openCheckProject(fx)
    insertJob(p.db(), {
      id: 'old',
      kind: 'export',
      status,
      campaignId: p.campaignId,
      provider: 'adman',
      request: JSON.stringify(REQUEST),
      createdAt: '2026-11-20T10:00:00.000Z',
    })
    const before = readWireRows(p.db(), 'job')
    const enqueue = vi.spyOn(fx.core.deps.jobs, 'enqueue')
    const set = vi.spyOn(fx.core.deps.export.plans, 'set')
    const start = fx.events.length
    expect(await fx.user('job.retry', { projectId: p.projectId, jobId: 'old' })).toEqual({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: 'Run the export again from the Export dialog.',
        details: { reason: 'export_not_retried' },
      },
    })
    expect(enqueue).not.toHaveBeenCalled()
    expect(set).not.toHaveBeenCalled()
    expect(readWireRows(p.db(), 'job')).toEqual(before)
    expect(fx.events.slice(start).filter((e) => e.name === 'project.changed')).toEqual([])
  })
})
