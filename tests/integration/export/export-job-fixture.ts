// Test helper for P8-6: an open project with one campaign in two sizes and two languages, an
// output folder, a stand-in draw, picture encoder and report port, and a way to run one export
// job through the real runner. Not a test file itself.
import fs from 'node:fs'
import path from 'node:path'
import { vi } from 'vitest'
import { data, makeFixture } from '../core-fixture'
import { openCheckProject } from '../checks/check-fixture'
import { readWireRow, readWireRows } from '@/main/db/rows'
import { createRenderService } from '@/main/thumbnails/service'
import type { ProjectContext } from '@/main/commands/types'
import type { DrawScene } from '@/main/thumbnails/types'
import type { ExportPictures, ExportPlan, ExportReport } from '@/main/export/types'
import type { BusEvent } from '@/main/commands/bus'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { VariantRow } from '@/shared/schemas/rows/variant'

export type ExportSetup = Awaited<ReturnType<typeof setupExport>>
type Size = { width: number; height: number }

const ENDED = new Set(['succeeded', 'failed', 'cancelled'])
const pngFor = (size: Size) =>
  new Uint8Array([137, 80, 78, 71, ...Buffer.from(`${size.width}x${size.height}`)])

function listFiles(dir: string, base = ''): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const rel = base ? `${base}/${e.name}` : e.name
    if (e.isDirectory()) return [rel, ...listFiles(path.join(dir, e.name), rel)]
    return [rel]
  })
}

export async function setupExport() {
  const fx = makeFixture()
  const p = await openCheckProject(fx)
  const { projectId, campaignId } = p
  const master = p.variant(p.variantIds()[0] as string)
  for (const language of ['en', 'de']) {
    const input = { projectId, directionId: master.directionId, sizeLabel: '9x16', language }
    data(await fx.user('variant.add', { ...input, format: 'image' }))
  }
  const root = fs.realpathSync(fs.mkdtempSync(path.join(fx.root, 'Exports-')))
  const db = p.db
  const draws = { count: 0, cancelAt: 0, failWhen: (_size: Size) => false, jobId: '' }
  const draw: DrawScene = async (_input, size) => {
    draws.count++
    if (draws.count === draws.cancelAt) await fx.core.deps.jobs.cancel(projectId, draws.jobId)
    if (draws.failWhen(size)) throw new Error('The draw failed')
    return { png: pngFor(size), overflow: {} }
  }
  fx.core.deps.render = createRenderService({
    deps: () => fx.core.deps,
    bus: () => fx.core.bus,
    emit: () => undefined,
    draw,
  })
  const toJpeg = vi.fn((_png: Uint8Array, quality: number) => new Uint8Array([0xff, 0xd8, quality]))
  const shrink = vi.fn((_png: Uint8Array, side: number) => new Uint8Array([0xff, 0xd8, side]))
  const pictures = { toJpeg, shrink, stitch: vi.fn() } as unknown as ExportPictures
  fx.core.deps.exportPictures = pictures
  const coreReport = fx.core.deps.export.report
  const report = vi.fn<ExportReport['write']>(async () => 'R1')
  fx.core.deps.export.report = { write: report }

  const variants = () => readWireRows(db(), 'variant') as VariantRow[]
  const jobRow = (id: string) => readWireRow(db(), 'job', { id }) as JobRow

  async function waitEnd(id: string): Promise<JobRow> {
    for (let i = 0; i < 500; i++) {
      const row = jobRow(id)
      if (ENDED.has(row.status)) return row
      await new Promise((r) => setTimeout(r, 10))
    }
    throw new Error('The export job did not end')
  }

  return {
    fx,
    root,
    projectId,
    campaignId,
    toJpeg,
    shrink,
    report,
    variant: (id: string) => p.variant(id),
    // The layout's order: one title, so size label, language, then ID.
    ordered: () =>
      [...variants()].sort(
        (a, b) =>
          a.sizeLabel.localeCompare(b.sizeLabel) ||
          a.language.localeCompare(b.language) ||
          (a.id < b.id ? -1 : 1),
      ),
    jobRow,
    errorDetail: (id: string) =>
      (
        db().prepare('SELECT error_detail FROM job WHERE id = ?').get(id) as {
          error_detail: string
        }
      ).error_detail,
    files: () => listFiles(root).filter((n) => fs.statSync(path.join(root, n)).isFile()),
    allNames: () => listFiles(root),
    reportOutcomes: () => report.mock.calls[0]?.[3] ?? [],
    progressSeen: () => {
      const seen = fx.events
        .filter((e: BusEvent) => e.name === 'job.updated')
        .map((e) => e.payload as JobRow)
        .filter((row) => row.id === draws.jobId && (row.progress ?? 0) > 0)
        .map((row) => row.progress)
      return seen.filter((v, i) => v !== seen[i - 1])
    },
    failDrawWhen: (fn: (size: Size) => boolean) => void (draws.failWhen = fn),
    cancelOnDraw: (n: number) => void (draws.cancelAt = n),
    useCoreReport: () => void (fx.core.deps.export.report = coreReport),
    makeVideo: (id: string) =>
      void db().prepare("UPDATE variant SET format = 'video' WHERE id = ?").run(id),
    useMissingPicture(variantId: string, displayName: string) {
      db()
        .prepare(
          `INSERT INTO asset (id, library, kind, origin, storage, display_name, abs_path, rel_path,
            mime, byte_size, mtime_ms, content_hash, created_at)
           VALUES ('A-missing', 'asset', 'image', 'imported', 'managed', ?, '/nowhere/gone.png',
            'assets/gone.png',
            'image/png', 10, 1, 'h', 'x')`,
        )
        .run(displayName)
      db()
        .prepare("UPDATE layer SET source = ? WHERE variant_id = ? AND type = 'background'")
        .run(JSON.stringify({ assetId: 'A-missing' }), variantId)
    },
    async run(over: Partial<ExportPlan> = {}, opts: { withoutPlan?: boolean } = {}) {
      const plan: ExportPlan = {
        projectId,
        campaignId,
        root,
        variantIds: variants().map((v) => v.id),
        imageFormat: 'png',
        jpgQuality: 90,
        fps: 30,
        warningsSeen: [],
        proceeded: null,
        ...over,
      }
      const { variantIds, imageFormat, jpgQuality, fps } = plan
      const ctx = { project: fx.core.deps.projects.requireOpen(projectId) } as ProjectContext
      const id = fx.core.deps.jobs.enqueue(ctx, {
        kind: 'export',
        campaignId,
        variantId: null,
        layerId: null,
        slot: null,
        provider: 'adman',
        model: '',
        request: { variantIds, imageFormat, jpgQuality, fps, proceedDespiteWarnings: false },
        startedBy: 'user',
      })
      draws.jobId = id
      if (!opts.withoutPlan) fx.core.deps.export.plans.set(id, plan)
      return waitEnd(id)
    },
  }
}
