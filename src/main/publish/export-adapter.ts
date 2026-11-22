// The export ports as publish uses them (spec/phases/phase-09.md "The export interface";
// spec/export-and-checks.md "Export", "Report", "Translation sheet"). Security class short: it
// writes in the publish job's private work folder and nowhere else.
//
// exportForPublish runs Phase 8's runExport inside the publish job, on every ad of the campaign,
// into outputRoot, which must be a real folder at its own real path (the checks target.ts
// makes; every write goes through exportTarget, which makes them again). The difference from
// "The export interface" is absorbed here (Q-P9-4): runExport wants a job context, so it gets
// one made from the port's input that makes no provider call, and whose report.add saves
// nothing: a publish inserts no report row (ruling, P9-11), so no work folder path is stored and
// a publish is not counted as an export. The publish header is written at the top of both
// report files once Phase 8 has written them; Phase 6's sheet is added when it has rows. A
// publish is all or nothing about its ads (ruling, P9-11): if any ad fails, the export ends
// export_failed before any report is written, so nothing is uploaded or cleaned up and the
// earlier published copy of that ad stays. warningsForPublish gives Phase 8's checks as
// PublishWarning: the check's fixed name and the finding's own message.
import fs from 'node:fs/promises'
import nodePath from 'node:path'
import { warningsGate } from '@/main/commands/export/warnings'
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectHandle } from '@/main/db/project-file'
import { element } from '@/main/export/report/escape'
import { utcTime } from '@/main/export/report/html-parts'
import { CHECK_NAMES } from '@/main/export/report/html-words'
import { runExport } from '@/main/export/run-export'
import { exportTarget, type ExportTargetAt } from '@/main/export/target'
import type { ExportPlan, ExportReport, VariantOutcome } from '@/main/export/types'
import { LocalFailure } from '@/main/jobs/local-failure'
import type { JobRunContext } from '@/main/jobs/types'
import { localStorageAt } from '@/main/providers/local-storage'
import { ProviderCancelled } from '@/main/providers/types'
import { requireCampaign } from '@/main/queries/campaign-reads'
import { translationRows } from '@/main/translation/rows'
import type { ExportWarning } from '@/shared/schemas/commands/export'
import { ok } from '@/shared/schemas/result'
import { sheetCsv } from '@/shared/translation/sheet'
import type {
  ExportedFile,
  ExportForPublishInput,
  ExportForPublishResult,
  PublishHeader,
  PublishWarning,
} from './ports'

const SHEET = 'translations.csv'
const REPORT_NAME = /^report-\d{8}-\d{6}(-\d{1,2})?\.(html|json)$/
const encode = (text: string) => new TextEncoder().encode(text)
const failed = () => new LocalFailure('export_failed')

function campaignVariantIds(project: ProjectHandle, campaignId: string): string[] {
  const rows = project.db
    .prepare(
      `SELECT v.id AS id FROM variant v JOIN direction d ON d.id = v.direction_id
       WHERE d.campaign_id = ? ORDER BY v.id`,
    )
    .all(campaignId) as Array<{ id: string }>
  return rows.map((r) => r.id)
}

// target.ts's root checks, before anything is read: a real folder, not a link, at its real path.
async function checkRoot(root: string): Promise<void> {
  const safe =
    nodePath.isAbsolute(root) &&
    (await fs.lstat(root).then(
      async (s) => s.isDirectory() && (await fs.realpath(root)) === root,
      () => false,
    ))
  if (!safe) throw new LocalFailure('work_folder_unsafe')
}

// Every finding of each warn result, in the ads' order (Phase 8's gate, never refusing).
function warningsNow(deps: CoreDeps, project: ProjectHandle, variantIds: string[]) {
  return warningsGate(deps.export.checks, project, { variantIds, proceedDespiteWarnings: true })
}

// Only report.add is answered, and it saves no row: a publish is not an export.
function noReportRow(command: string) {
  if (command !== 'report.add') throw failed()
  return ok({ reportId: null })
}

// Keeps the ads' ends for the answer; refuses before the report unless every ad was exported.
function keepingOutcomes(inner: ExportReport, kept: VariantOutcome[]): ExportReport {
  return {
    write(jc, plan, target, outcomes, checks) {
      if (outcomes.length === 0 || outcomes.some((o) => o.file === null)) throw failed()
      kept.push(...outcomes)
      return inner.write(jc, plan, target, outcomes, checks)
    },
  }
}

function publishContext(
  deps: CoreDeps,
  input: ExportForPublishInput,
  report: ExportReport,
): JobRunContext {
  return {
    deps: { ...deps, export: { ...deps.export, report } },
    projectId: input.projectId,
    signal: input.signal,
    call: () => Promise.reject(failed()),
    progress: (fraction) => input.onProgress(fraction),
    cancelled: () => input.signal.aborted,
    system: async (command) => noReportRow(command),
    onProgress: () => undefined,
    setRemoteJobId: () => undefined,
    keep: () => undefined,
  }
}

const headerLine = (h: PublishHeader) =>
  `Published ${utcTime(h.publishedAt)}, publish ${h.publishNumber}.`

function withHeader(name: string, text: string, header: PublishHeader): string {
  if (name.endsWith('.json'))
    return `${JSON.stringify({ publish: header, ...JSON.parse(text) }, null, 2)}\n`
  const body = '<body>\n'
  if (text.split(body).length !== 2) throw failed()
  return text.replace(body, `${body}${element('p', headerLine(header))}\n`)
}

// The one report pair Phase 8 wrote in the new work folder, with the header at the top.
async function reportFiles(
  root: string,
  target: ExportTargetAt,
  campaignId: string,
  header: PublishHeader | null,
): Promise<ExportedFile[]> {
  const storage = localStorageAt(root)
  const prefix = `${campaignId}/`
  const names = (await storage.list(prefix))
    .map((p) => p.slice(prefix.length))
    .filter((name) => REPORT_NAME.test(name))
  const html = names.filter((n) => n.endsWith('.html'))
  const json = names.filter((n) => n.endsWith('.json'))
  if (html.length !== 1 || json.length !== 1 || !html[0] || !json[0]) throw failed()
  const pair = [
    ['report_html', html[0]],
    ['report_json', json[0]],
  ] as const
  const files: ExportedFile[] = []
  for (const [role, name] of pair) {
    const rel = `${prefix}${name}`
    if (header) {
      const text = new TextDecoder().decode(await storage.read(rel))
      await target.write(rel, encode(withHeader(name, text, header)))
    }
    files.push({ role, relPath: name, absPath: target.fullPath(rel) })
  }
  return files
}

async function sheetFiles(
  project: ProjectHandle,
  target: ExportTargetAt,
  campaignId: string,
): Promise<ExportedFile[]> {
  const rows = translationRows(project.db, requireCampaign(project.db, campaignId))
  if (rows.length === 0) return []
  const rel = `${campaignId}/${SHEET}`
  await target.write(rel, encode(sheetCsv(rows)))
  return [{ role: 'translations_csv', relPath: SHEET, absPath: target.fullPath(rel) }]
}

function adFile(target: ExportTargetAt, campaignId: string, file: string): ExportedFile {
  const prefix = `${campaignId}/`
  if (!file.startsWith(prefix)) throw failed()
  return { role: 'ad', relPath: file.slice(prefix.length), absPath: target.fullPath(file) }
}

export async function exportForPublish(
  deps: CoreDeps,
  input: ExportForPublishInput,
): Promise<ExportForPublishResult> {
  const { outputRoot: root, campaignId } = input
  await checkRoot(root)
  const project = deps.projects.requireOpen(input.projectId)
  const variantIds = campaignVariantIds(project, campaignId)
  const { imageFormat, jpgQuality, fps } = deps.settings.get().export
  const seen: ExportWarning[] = input.proceedDespiteWarnings
    ? await warningsNow(deps, project, variantIds)
    : []
  const plan: ExportPlan = {
    projectId: input.projectId,
    campaignId,
    root,
    variantIds,
    imageFormat,
    jpgQuality,
    fps,
    warningsSeen: seen,
    proceeded: input.proceedDespiteWarnings
      ? { at: deps.now().toISOString(), reason: input.proceedReason || null }
      : null,
  }
  const outcomes: VariantOutcome[] = []
  const jc = publishContext(deps, input, keepingOutcomes(deps.export.report, outcomes))
  const target = exportTarget(root)
  await runExport(jc, plan, target, { project })
  if (input.signal.aborted) throw new ProviderCancelled()
  const ads = outcomes.flatMap((o) => (o.file === null ? [] : [{ id: o.variantId, file: o.file }]))
  const files = [
    ...ads.map((ad) => adFile(target, campaignId, ad.file)),
    ...(await reportFiles(root, target, campaignId, input.publishHeader)),
    ...(await sheetFiles(project, target, campaignId)),
  ]
  input.onProgress(1)
  return { files, variantIds: ads.map((ad) => ad.id) }
}

export async function warningsForPublish(
  deps: CoreDeps,
  input: { projectId: string; campaignId: string },
): Promise<PublishWarning[]> {
  const project = deps.projects.requireOpen(input.projectId)
  const warnings = await warningsNow(deps, project, campaignVariantIds(project, input.campaignId))
  return warnings.map((w) => ({
    variantId: w.variantId,
    title: CHECK_NAMES[w.checkId],
    message: w.message,
  }))
}
