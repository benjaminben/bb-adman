// The export run (spec/phases/phase-08.md "Export run"): the checks again, then each ad in the
// layout's order, progress as done ads over all ads, a stop checked between ads, then the
// report. Security class short: every file goes through `target` under a name from adPath.
import type { ProjectHandle } from '@/main/db/project-file'
import { readWireRow } from '@/main/db/rows'
import type { JobRunContext } from '@/main/jobs/types'
import { ProviderCancelled } from '@/main/providers/types'
import { sceneInput } from '@/main/thumbnails/scene-input'
import { AD_FAILURES, missingFilesMessage } from '@/shared/export/messages'
import { adPath } from '@/shared/export/output-paths'
import { postTitle } from '@/shared/export/safe-title'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import type { VariantRow } from '@/shared/schemas/rows/variant'
import type { SceneInput } from '@/shared/scene/types'
import { failureSentence } from './failure'
import { exportImageAd } from './image-ad'
import type { ExportPlan, ExportTarget, VariantOutcome } from './types'

// The longest side of each ad's picture in the report (A-203).
export const REPORT_PICTURE_SIDE = 240

export type ExportResult = { exported: number; failed: number; reportId: string | null }
export type RunExportOpts = { project: ProjectHandle }

const variantRow = (project: ProjectHandle, id: string) =>
  readWireRow(project.db, 'variant', { id }) as VariantRow | null

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

// Sorted by postTitle, sizeLabel, language, variantId, so two runs write in the same order. An
// ad already gone sorts by its ID alone, before the others.
function ordered(project: ProjectHandle, variantIds: string[]): string[] {
  const keyed = variantIds.map((id) => {
    const row = variantRow(project, id)
    return { id, key: row ? [postTitle(row.title), row.sizeLabel, row.language] : ['', '', ''] }
  })
  const byKey = (a: (typeof keyed)[number], b: (typeof keyed)[number]) =>
    a.key.reduce((n, part, i) => n || compare(part, b.key[i] as string), 0) || compare(a.id, b.id)
  return keyed.sort(byKey).map((k) => k.id)
}

function missingNames(project: ProjectHandle, input: SceneInput): string[] {
  return Object.entries(input.assets)
    .filter(([, asset]) => asset.missing)
    .map(([id]) => {
      const row = readWireRow(project.db, 'asset', { id }) as AssetRow | null
      return row?.displayName ?? id
    })
}

const failure = (variantId: string, rev: number | null, sentence: string): VariantOutcome => ({
  variantId,
  rev,
  file: null,
  failure: sentence,
  picture: null,
})

function reportPicture(jc: JobRunContext, png: Uint8Array | null): Uint8Array | null {
  if (!png) return null
  try {
    return jc.deps.exportPictures.shrink(png, REPORT_PICTURE_SIDE)
  } catch {
    return null
  }
}

async function exportAd(
  jc: JobRunContext,
  project: ProjectHandle,
  plan: ExportPlan,
  target: ExportTarget,
  variantId: string,
): Promise<VariantOutcome> {
  const row = variantRow(project, variantId)
  const scene = row && (await sceneInput(jc.deps, project, variantId))
  if (!row || !scene) return failure(variantId, null, AD_FAILURES.deleted)
  const missing = missingNames(project, scene.input)
  if (missing.length > 0) return failure(variantId, null, missingFilesMessage(missing))
  const video = row.format === 'video'
  const fallback = video ? AD_FAILURES.videoNotMade : AD_FAILURES.notWritten
  try {
    const ext = video ? 'mp4' : plan.imageFormat
    const { title, sizeLabel, language } = row
    const file = adPath({ campaignId: plan.campaignId, title, sizeLabel, language, variantId, ext })
    const png = video
      ? (await jc.deps.export.video.exportVariant(jc, scene.input, plan, target, file)).still
      : await exportImageAd(jc, scene.input, plan, target, file)
    return { variantId, rev: scene.rev, file, failure: null, picture: reportPicture(jc, png) }
  } catch (e) {
    if (e instanceof ProviderCancelled) throw e
    return failure(variantId, scene.rev, failureSentence(e, fallback))
  }
}

export async function runExport(
  jc: JobRunContext,
  plan: ExportPlan,
  target: ExportTarget,
  opts: RunExportOpts,
): Promise<ExportResult> {
  const { project } = opts
  const ports = jc.deps.export
  const checks = await ports.checks.run(project, plan.variantIds)
  ports.checks.store(project, checks, 'export')
  const ads = ordered(project, plan.variantIds)
  const outcomes: VariantOutcome[] = []
  for (const variantId of ads) {
    if (jc.cancelled()) throw new ProviderCancelled()
    outcomes.push(await exportAd(jc, project, plan, target, variantId))
    jc.progress(outcomes.length / ads.length)
  }
  if (jc.cancelled()) throw new ProviderCancelled()
  const reportId = await ports.report.write(jc, plan, target, outcomes, checks)
  const exported = outcomes.filter((o) => o.failure === null).length
  return { exported, failed: outcomes.length - exported, reportId }
}
