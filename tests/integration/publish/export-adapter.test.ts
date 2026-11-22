// P9-11 (spec/phases/phase-09.md "The export interface"; spec/export-and-checks.md "Export",
// "Report", "Translation sheet"): the export adapter runs Phase 8's export inside the publish
// job, into the work folder only, with the publish header at the top of both report files, and
// Phase 6's sheet when the campaign has ads in a second language. Its warnings are Phase 8's
// checks as PublishWarning. A failed export ends export_failed with nothing uploaded. The draw
// is a stand-in; storage is local storage on a temporary folder. No provider call is made.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { LocalFailure } from '@/main/jobs/local-failure'
import { ProviderCancelled } from '@/main/providers/types'
import { exportForPublish, warningsForPublish } from '@/main/publish/export-adapter'
import type { ExportedFile } from '@/main/publish/ports'
import { postTitle } from '@/shared/export/safe-title'
import type { ReportCheck } from '@/shared/schemas/report'
import { adapterSetUp, PNG_START, type AdapterSetUp } from './export-adapter-setup'

let s: AdapterSetUp | undefined
afterEach(() => {
  s?.fx.cleanup()
  s = undefined
  vi.restoreAllMocks()
})

async function setUp() {
  s = await adapterSetUp()
  return s
}

const read = (file: ExportedFile) => fs.readFileSync(file.absPath)
const byRole = (files: ExportedFile[], role: ExportedFile['role']) =>
  files.filter((f) => f.role === role)

describe('exportForPublish [P9-11]', () => {
  it('writes the two ads, both reports with the publish header and the sheet, in the work folder', async () => {
    const x = await setUp()
    const fractions: number[] = []
    const result = await exportForPublish(
      x.fx.core.deps,
      x.input({ onProgress: (f) => fractions.push(f) }),
    )
    const ids = x.p.variantIds()
    expect([...result.variantIds].sort()).toEqual(ids)
    const ads = byRole(result.files, 'ad')
    const expected = ids.map((id) => {
      const v = x.p.variant(id)
      return `${postTitle(v.title)}/${v.sizeLabel}/${v.language}-${v.id}.png`
    })
    expect(ads.map((f) => f.relPath).sort()).toEqual(expected.sort())
    for (const ad of ads) {
      const rel = ad.relPath
      expect(ad.absPath).toBe(path.join(x.work, x.p.campaignId, rel))
      expect([...read(ad).subarray(0, 4)]).toEqual(PNG_START)
    }
    const [html] = byRole(result.files, 'report_html')
    const [json] = byRole(result.files, 'report_json')
    expect(html?.relPath).toMatch(/^report-\d{8}-\d{6}\.html$/)
    expect(json?.relPath).toMatch(/^report-\d{8}-\d{6}\.json$/)
    const body = read(html as ExportedFile).toString('utf8')
    expect(body).toContain('Published 2026-11-21 09:30 UTC, publish 2.')
    expect(body.indexOf('publish 2')).toBeLessThan(body.indexOf('<header>'))
    const report = JSON.parse(read(json as ExportedFile).toString('utf8'))
    expect(Object.keys(report)[0]).toBe('publish')
    expect(report.publish).toEqual({ publishedAt: '2026-11-21T09:30:00.000Z', publishNumber: 2 })
    expect(report.proceeded).toMatchObject({ reason: 'Signed off by the client' })
    const [sheet] = byRole(result.files, 'translations_csv')
    expect(sheet?.relPath).toBe('translations.csv')
    const csv = read(sheet as ExportedFile)
    expect([...csv.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(csv.subarray(3).toString('utf8')).toMatch(/^"variant_id",/)
    for (const file of result.files) {
      expect(file.relPath.startsWith('exports/')).toBe(false)
      expect(file.absPath.startsWith(`${x.work}${path.sep}`)).toBe(true)
    }
    expect(result.files).toHaveLength(5)
    expect(x.reportRows()).toBe(1)
    expect(fractions.at(-1)).toBe(1)
  })

  it('writes no sheet when every ad is in the campaign main language, and no header when none', async () => {
    const x = await setUp()
    x.p
      .db()
      .prepare("UPDATE variant SET language = 'en', size_label = 'B' WHERE language = 'de'")
      .run()
    const result = await exportForPublish(x.fx.core.deps, x.input({ publishHeader: null }))
    expect(byRole(result.files, 'translations_csv')).toEqual([])
    expect(fs.existsSync(path.join(x.work, x.p.campaignId, 'translations.csv'))).toBe(false)
    const [json] = byRole(result.files, 'report_json')
    expect(JSON.parse(read(json as ExportedFile).toString('utf8'))).not.toHaveProperty('publish')
    expect(read(byRole(result.files, 'report_html')[0] as ExportedFile).toString()).not.toContain(
      'Published ',
    )
  })

  it('refuses a work folder that is a link, writing nothing through it', async () => {
    const x = await setUp()
    const link = path.join(x.fx.root, 'work-link')
    fs.symlinkSync(x.work, link)
    const failure = exportForPublish(x.fx.core.deps, x.input({ outputRoot: link }))
    await expect(failure).rejects.toBeInstanceOf(LocalFailure)
    await expect(failure).rejects.toMatchObject({ reason: 'work_folder_unsafe' })
    expect(fs.readdirSync(x.work)).toEqual([])
    expect(x.reportRows()).toBe(0)
  })

  it('stops with ProviderCancelled when the publish was cancelled, and writes no report', async () => {
    const x = await setUp()
    const stop = new AbortController()
    stop.abort()
    const failure = exportForPublish(x.fx.core.deps, x.input({ signal: stop.signal }))
    await expect(failure).rejects.toBeInstanceOf(ProviderCancelled)
    expect(x.reportRows()).toBe(0)
  })
})

describe('warningsForPublish [P9-11]', () => {
  it("gives each finding of a warning as { variantId, title, message }, with the check's name", async () => {
    const x = await setUp()
    const [first] = x.p.variantIds()
    const warn: ReportCheck = {
      checkId: 'prohibited-words',
      group: 'brand-legal',
      status: 'warn',
      findings: [{ layerId: 'L1', message: 'Uses a word the brief forbids.' }, { message: 'Two.' }],
    }
    vi.spyOn(x.fx.core.deps.export.checks, 'run').mockImplementation(
      async (_project, ids) => new Map(ids.map((id) => [id, id === first ? [warn] : []])),
    )
    const warnings = await warningsForPublish(x.fx.core.deps, {
      projectId: x.p.projectId,
      campaignId: x.p.campaignId,
    })
    expect(warnings).toEqual([
      { variantId: first, title: 'Prohibited words', message: 'Uses a word the brief forbids.' },
      { variantId: first, title: 'Prohibited words', message: 'Two.' },
    ])
    expect(x.p.checkRow(first as string)).toBeNull()
  })
})

describe('the publish job with the export adapter [P9-11]', () => {
  it('publishes real ads under exports/, the report with "publish 1" and the sheet', async () => {
    const x = await setUp()
    const job = await x.publish()
    expect(job.status).toBe('succeeded')
    const files = x.storageFiles()
    const campaign = x.p.campaignId
    expect(files.filter((f) => f.startsWith(`${campaign}/exports/`))).toHaveLength(2)
    expect(files).toEqual(
      expect.arrayContaining([
        `${campaign}/report.html`,
        `${campaign}/report.json`,
        `${campaign}/translations.csv`,
        `${campaign}/manifest.json`,
      ]),
    )
    const html = fs.readFileSync(path.join(x.storageRoot, campaign, 'report.html'), 'utf8')
    expect(html).toContain(', publish 1.')
    expect(job.paidCalls).toBe(0)
  })

  it('keeps the publish reason out of the job row, every event and the log', async () => {
    const x = await setUp()
    const reason = 'Reason-Only-For-The-Report-7Qx'
    const job = await x.publish({ proceedReason: reason })
    expect(job.status).toBe('succeeded')
    const row = x.p.db().prepare('SELECT * FROM job WHERE id = ?').get(job.id)
    expect(JSON.stringify(row)).not.toContain(reason)
    expect(JSON.stringify(x.fx.events)).not.toContain(reason)
    expect(x.fx.readLogs()).not.toContain(reason)
    const json = fs.readFileSync(path.join(x.storageRoot, x.p.campaignId, 'report.json'), 'utf8')
    expect(json).toContain(reason)
  })

  it('ends export_failed when no ad could be exported, and uploads nothing', async () => {
    const x = await setUp()
    x.draws.fail = true
    const job = await x.publish()
    expect(job).toMatchObject({ status: 'failed', errorReason: 'export_failed' })
    expect(x.storageFiles()).toEqual([])
  })
})
