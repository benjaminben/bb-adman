// P8-13 (spec/phases/phase-08.md "Export run", warnings gate and the job; spec/export-and-checks.md
// "Checks"): the export gate and the report use Phase 6's six checks. A rule set whose
// prohibited word an ad uses makes prohibited-words warn: export.run refuses it, an export past
// it lists it in the report, and the job stores its results with ran_by export.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { data, type Fixture } from '../core-fixture'
import { setupExport, type ExportSetup } from './export-job-fixture'
import { readWireRows } from '@/main/db/rows'
import type { ExportHasWarningsDetails, ExportWarning } from '@/shared/schemas/commands/export'
import type { Report } from '@/shared/schemas/report'
import type { Result } from '@/shared/schemas/result'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantCheckRow } from '@/shared/schemas/rows/variant-check'

let fx: Fixture | undefined
afterEach(() => {
  fx?.cleanup()
  fx = undefined
})

const REASON = 'Legal agreed to the wording.'

async function setup() {
  const s = await setupExport()
  fx = s.fx
  s.useCoreReport()
  data(
    await s.fx.user('ruleSet.update', {
      projectId: s.projectId,
      campaignId: s.campaignId,
      requiredAssetIds: [],
      palette: [],
      requiredWords: {},
      prohibitedWords: { en: ['cheap'] },
    }),
  )
  const folder = path.join(s.fx.documents, 'Exports-Checks')
  fs.mkdirSync(folder)
  const ads = s.ordered().filter((v) => v.language === 'en')
  return { s, folder, first: ads[0]?.id as string, second: ads[1]?.id as string }
}

async function useWord(s: ExportSetup, variantId: string, copy: string) {
  const db = s.fx.core.deps.projects.requireOpen(s.projectId).db
  const text = (readWireRows(db, 'layer') as LayerRow[]).find(
    (l) => l.variantId === variantId && l.type === 'text',
  )
  data(
    await s.fx.user('layer.update', { projectId: s.projectId, layerId: text?.id, patch: { copy } }),
  )
}

function exportInput(s: ExportSetup, folder: string, proceed: boolean) {
  return {
    projectId: s.projectId,
    campaignId: s.campaignId,
    variantIds: s.ordered().map((v) => v.id),
    outputDir: folder,
    imageFormat: 'png',
    jpgQuality: 90,
    fps: 30,
    proceedDespiteWarnings: proceed,
    ...(proceed ? { reason: REASON } : {}),
  }
}

async function waitEnd(s: ExportSetup, jobId: string) {
  for (let i = 0; i < 500; i++) {
    const row = s.jobRow(jobId)
    if (['succeeded', 'failed', 'cancelled'].includes(row.status)) return row
    await new Promise((r) => setTimeout(r, 10))
  }
  throw new Error('The export job did not end')
}

function readReport(root: string, campaignId: string): Report {
  const dir = path.join(root, campaignId)
  const name = fs.readdirSync(dir).find((n) => n.startsWith('report-') && n.endsWith('.json'))
  return JSON.parse(fs.readFileSync(path.join(dir, name as string), 'utf8')) as Report
}

const checkRow = (s: ExportSetup, variantId: string) =>
  (
    readWireRows(
      s.fx.core.deps.projects.requireOpen(s.projectId).db,
      'variant_check',
    ) as VariantCheckRow[]
  ).find((r) => r.variantId === variantId)

function refusedWarnings(reply: Result<unknown>): ExportWarning[] {
  if (reply.ok) throw new Error('Expected export.run to refuse')
  return (reply.error.details as ExportHasWarningsDetails).warnings
}

const prohibited = (warnings: ExportWarning[]) =>
  warnings.filter((w) => w.checkId === 'prohibited-words')

describe('checks in the export gate and the report [P8-13, FR-114, FR-236, A-204]', () => {
  it('refuses with export_has_warnings naming prohibited-words', async () => {
    const { s, folder, first } = await setup()
    await useWord(s, first, 'Cheap and cold')
    const reply = await s.fx.user('export.run', exportInput(s, folder, false))
    expect(reply).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'export_has_warnings' } },
    })
    expect(prohibited(refusedWarnings(reply)).map((w) => w.variantId)).toEqual([first])
  })

  it('with proceed: the report lists the warning as seen, with who, when and reason', async () => {
    const { s, folder, first } = await setup()
    await useWord(s, first, 'Cheap and cold')
    const reply = await s.fx.user('export.run', exportInput(s, folder, true))
    const job = await waitEnd(s, data<{ jobId: string }>(reply).jobId)
    expect(job.status).toBe('succeeded')
    const report = readReport(fs.realpathSync(folder), s.campaignId)
    expect(report.checksRun).toBe(true)
    expect(report.proceeded).toMatchObject({ reason: REASON, at: expect.any(String) })
    expect(report.proceeded && 'by' in report.proceeded).toBe(true)
    const listed = report.warningsExportedPast.filter((w) => w.checkId === 'prohibited-words')
    expect(listed.map((w) => [w.variantId, w.seenBeforeExport])).toEqual([[first, true]])
    const ad = report.variants.find((v) => v.variantId === first)
    expect(ad?.checks.find((c) => c.checkId === 'prohibited-words')?.status).toBe('warn')
    expect(ad?.checks).toHaveLength(6)
  })

  it("stores each ad's results with ran_by export and the drawn rev", async () => {
    const { s, folder, first } = await setup()
    await useWord(s, first, 'Cheap and cold')
    const reply = await s.fx.user('export.run', exportInput(s, folder, true))
    await waitEnd(s, data<{ jobId: string }>(reply).jobId)
    const report = readReport(fs.realpathSync(folder), s.campaignId)
    for (const ad of report.variants) {
      const row = checkRow(s, ad.variantId)
      expect(row).toMatchObject({ ranBy: 'export', checkedRev: ad.rev })
      expect(row?.checkedRev).toBe(s.variant(ad.variantId).rev)
      expect(row?.results).toEqual(ad.checks)
    }
  })

  it('marks a warning added between the gate and the job as not seen before export', async () => {
    const { s, folder, first, second } = await setup()
    await useWord(s, first, 'Cheap and cold')
    const refused = await s.fx.user('export.run', exportInput(s, folder, false))
    const seen = refusedWarnings(refused)
    await useWord(s, second, 'Cheap and tall')
    const job = await s.run({
      warningsSeen: seen,
      proceeded: { at: '2026-11-21T09:00:00.000Z', reason: REASON },
    })
    expect(job.status).toBe('succeeded')
    const report = readReport(s.root, s.campaignId)
    const listed = report.warningsExportedPast.filter((w) => w.checkId === 'prohibited-words')
    expect(listed.map((w) => [w.variantId, w.seenBeforeExport])).toEqual(
      expect.arrayContaining([
        [first, true],
        [second, false],
      ]),
    )
    expect(listed).toHaveLength(2)
  })
})
