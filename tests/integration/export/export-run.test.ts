// P8-5 (spec/phases/phase-08.md "The output folder (security)", "Export run"): export.run checks
// its input, the folder, the campaign's other export and the warnings, then queues one export
// job. The plan, with the real folder path, stays in memory (A-195): the path never reaches the
// job row, the project file, an event, a log line or a reply.
import fs from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { data } from '../core-fixture'
import { readWireRow } from '@/main/db/rows'
import {
  NOW,
  cleanupExportRun,
  expectNoPath,
  exportRows,
  setup,
  warnOnFirst,
} from './export-run-fixture'

afterEach(cleanupExportRun)

describe('export.run queues one export job with its plan [P8-5, A-195, A-207]', () => {
  it('stores the job row without the path and keeps the plan in memory', async () => {
    const { fx, p, folder, input } = await setup()
    const set = vi.spyOn(fx.core.deps.export.plans, 'set')
    // A job row is not named in project.changed (the job events carry it), so the one new row
    // is checked here rather than with expect-changes.
    const reply = await fx.user('export.run', input)
    const { jobId } = data<{ jobId: string }>(reply)
    expect(reply).toEqual({ ok: true, data: { jobId } })
    expect(exportRows(p).map((r) => (r as { id: string }).id)).toEqual([jobId])
    expect(readWireRow(p.db(), 'job', { id: jobId })).toMatchObject({
      kind: 'export',
      campaignId: p.campaignId,
      variantId: null,
      layerId: null,
      slot: null,
      provider: 'adman',
      model: '',
      startedBy: 'user',
      request: {
        variantIds: input.variantIds,
        imageFormat: 'jpg',
        jpgQuality: 85,
        fps: 30,
        proceedDespiteWarnings: false,
      },
    })
    expect(set).toHaveBeenCalledTimes(1)
    expect(set).toHaveBeenCalledWith(jobId, {
      projectId: p.projectId,
      campaignId: p.campaignId,
      root: fs.realpathSync(folder),
      variantIds: input.variantIds,
      imageFormat: 'jpg',
      jpgQuality: 85,
      fps: 30,
      warningsSeen: [],
      proceeded: null,
    })
    expectNoPath(fx, p, reply)
  })

  it('stores the request exactly, with no path and no reason text', async () => {
    const { fx, p, input } = await setup()
    const reason = 'Client signed off on the call'
    const reply = await fx.user('export.run', { ...input, proceedDespiteWarnings: true, reason })
    const { jobId } = data<{ jobId: string }>(reply)
    const row = readWireRow(p.db(), 'job', { id: jobId }) as { request: unknown }
    expect(row.request).toEqual({
      variantIds: input.variantIds,
      imageFormat: 'jpg',
      jpgQuality: 85,
      fps: 30,
      proceedDespiteWarnings: true,
    })
    const file = fs.readFileSync(fx.core.deps.projects.requireOpen(p.projectId).filePath)
    expect(file.includes(reason)).toBe(false)
  })
})

describe('export.run past warnings [P8-5, FR-236]', () => {
  it('keeps the warnings it saw and the reason in the plan; the log line says proceeded only', async () => {
    const { fx, p, input } = await setup()
    warnOnFirst(fx, input.variantIds as string[])
    const set = vi.spyOn(fx.core.deps.export.plans, 'set')
    const reason = 'Legal approved the wording on the phone'
    const reply = await fx.user('export.run', { ...input, proceedDespiteWarnings: true, reason })
    const { jobId } = data<{ jobId: string }>(reply)
    const [first] = input.variantIds as string[]
    expect(set).toHaveBeenCalledWith(
      jobId,
      expect.objectContaining({
        warningsSeen: [
          {
            variantId: first,
            checkId: 'prohibited-words',
            message: 'Uses a word the brief forbids.',
          },
          { variantId: first, checkId: 'prohibited-words', message: 'Two.' },
        ],
        proceeded: { at: NOW.toISOString(), reason },
      }),
    )
    const logs = fx.readLogs()
    expect(logs).not.toContain(reason)
    const line = logs
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { name: string; context: Record<string, unknown> })
      .find((l) => l.name === 'export.run' && 'proceeded' in l.context)
    expect(line?.context.proceeded).toBe(true)
    expectNoPath(fx, p, reply)
  })

  it('keeps proceeded with no reason when none was given', async () => {
    const { fx, input } = await setup()
    warnOnFirst(fx, input.variantIds as string[])
    const set = vi.spyOn(fx.core.deps.export.plans, 'set')
    data(await fx.user('export.run', { ...input, proceedDespiteWarnings: true }))
    expect(set.mock.calls[0]?.[1].proceeded).toEqual({ at: NOW.toISOString(), reason: null })
  })
})
