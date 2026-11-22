// P8-5 (spec/phases/phase-08.md "Export run"; spec/testing.md "Refusal tests"): each refusal of
// export.run answers its code and reason, queues no job, keeps no plan, adds no undo entry and
// puts no path anywhere.
import fs from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { data } from '../core-fixture'
import { insertJob } from '../queries/job-row-fixture'
import { readWireRows } from '@/main/db/rows'
import { assetsDirOf } from '@/main/assets/service'
import type { VariantRow } from '@/shared/schemas/rows/variant'
import {
  cleanupExportRun,
  expectNoPath,
  exportRows,
  secondCampaign,
  setup,
  warnOnFirst,
  type Setup,
} from './export-run-fixture'

afterEach(cleanupExportRun)

type Refusal = {
  name: string
  arrange: (s: Setup) => Promise<Record<string, unknown>> | Record<string, unknown>
  code: string
  reason?: string
  message: string
}

const REFUSALS: Refusal[] = [
  {
    name: 'a variant of another campaign',
    async arrange({ fx, p, input }) {
      const before = new Set(p.variantIds())
      await secondCampaign(fx, p)
      const other = (readWireRows(p.db(), 'variant') as VariantRow[]).find((v) => !before.has(v.id))
      return { ...input, variantIds: [...(input.variantIds as string[]), other?.id] }
    },
    code: 'NOT_FOUND',
    message: 'That ad is not in this campaign.',
  },
  {
    name: 'a variant that does not exist',
    arrange: ({ input }) => ({ ...input, variantIds: ['01JZZZZZZZZZZZZZZZZZZZZZZZ'] }),
    code: 'NOT_FOUND',
    message: 'That ad is not in this campaign.',
  },
  {
    name: 'a queued export of the same campaign',
    arrange: ({ p, input }) => {
      const at = '2026-11-20T10:00:00.000Z'
      insertJob(p.db(), {
        id: 'J0',
        kind: 'export',
        status: 'queued',
        campaignId: p.campaignId,
        provider: 'adman',
        createdAt: at,
      })
      return input
    },
    code: 'RULE_VIOLATION',
    reason: 'export_running',
    message: 'This campaign is already being exported. Wait for it to finish.',
  },
  {
    name: 'a running export of the same campaign',
    arrange: ({ p, input }) => {
      const at = '2026-11-20T10:00:00.000Z'
      insertJob(p.db(), {
        id: 'J0',
        kind: 'export',
        status: 'running',
        campaignId: p.campaignId,
        provider: 'adman',
        createdAt: at,
      })
      return input
    },
    code: 'RULE_VIOLATION',
    reason: 'export_running',
    message: 'This campaign is already being exported. Wait for it to finish.',
  },
  {
    name: "the project's assets folder",
    arrange: ({ fx, p, input }) => {
      const assets = assetsDirOf(fx.core.deps.projects.requireOpen(p.projectId))
      fs.mkdirSync(assets, { recursive: true })
      return { ...input, outputDir: assets }
    },
    code: 'RULE_VIOLATION',
    reason: 'output_dir_refused',
    message: 'Choose another folder: this one cannot be used for an export.',
  },
  {
    name: 'the app data folder',
    arrange: ({ fx, input }) => ({ ...input, outputDir: fx.userData }),
    code: 'RULE_VIOLATION',
    reason: 'output_dir_refused',
    message: 'Choose another folder: this one cannot be used for an export.',
  },
  {
    name: 'a folder that is gone',
    arrange: ({ folder, input }) => {
      fs.rmSync(folder, { recursive: true })
      return input
    },
    code: 'RULE_VIOLATION',
    reason: 'output_dir_missing',
    message: 'The chosen folder is not there any more. Choose it again.',
  },
]

describe('export.run refusals write nothing [P8-5, spec/testing.md "Refusal tests"]', () => {
  it.each(REFUSALS)('$name', async (row) => {
    const { fx, p, ...rest } = await setup()
    const input = await row.arrange({ fx, p, ...rest })
    const jobsBefore = readWireRows(p.db(), 'job')
    const set = vi.spyOn(fx.core.deps.export.plans, 'set')
    const record = vi.spyOn(fx.core.undo, 'record')
    const start = fx.events.length
    const reply = await fx.user('export.run', input)
    expect(reply).toEqual({
      ok: false,
      error: {
        code: row.code,
        message: row.message,
        ...(row.reason && { details: { reason: row.reason } }),
      },
    })
    expect(readWireRows(p.db(), 'job')).toEqual(jobsBefore)
    expect(fx.events.slice(start).filter((e) => e.name === 'project.changed')).toEqual([])
    expect(set).not.toHaveBeenCalled()
    expect(record).not.toHaveBeenCalled()
    expectNoPath(fx, p, reply)
  })

  it('refuses warnings it did not proceed past, with each finding in details', async () => {
    const { fx, p, input } = await setup()
    warnOnFirst(fx, input.variantIds as string[])
    const set = vi.spyOn(fx.core.deps.export.plans, 'set')
    const start = fx.events.length
    const reply = await fx.user('export.run', input)
    const [first] = input.variantIds as string[]
    expect(reply).toEqual({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: 'Some ads have warnings. Fix them or export anyway.',
        details: {
          reason: 'export_has_warnings',
          warnings: [
            {
              variantId: first,
              checkId: 'prohibited-words',
              message: 'Uses a word the brief forbids.',
            },
            { variantId: first, checkId: 'prohibited-words', message: 'Two.' },
          ],
        },
      },
    })
    expect(exportRows(p)).toEqual([])
    expect(fx.events.slice(start).filter((e) => e.name === 'project.changed')).toEqual([])
    expect(set).not.toHaveBeenCalled()
  })

  it('lets an export of another campaign run beside it', async () => {
    const { fx, p, input } = await setup()
    const other = await secondCampaign(fx, p)
    const at = '2026-11-20T10:00:00.000Z'
    insertJob(p.db(), {
      id: 'J0',
      kind: 'export',
      status: 'running',
      campaignId: other,
      provider: 'adman',
      createdAt: at,
    })
    data(await fx.user('export.run', input))
  })

  it('refuses an agent before it reads the folder', async () => {
    const { fx, p, input } = await setup()
    const reply = await fx.agent('export.run', input)
    expect(reply).toMatchObject({ ok: false, error: { code: 'AGENT_DENIED' } })
    expect(exportRows(p)).toEqual([])
    expectNoPath(fx, p, reply)
  })
})
