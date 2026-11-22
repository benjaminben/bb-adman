// The export report's files and row (spec/phases/phase-08.md "Report", saved; "The output
// folder", overwrite rule). Security class: it writes in the output folder. The report is built
// from the facts, then written as report-{stamp}.json and .html in {campaignId}/ through its own
// exportTarget(plan.root), whose writeNew never replaces a file (A-193); then report.add saves
// the row. A failure ends the job with a fixed sentence; no path goes into it.
import type { CoreDeps } from '@/main/core-deps'
import { buildReport } from './report/build'
import { reportFacts } from './report/facts'
import { reportHtml } from './report/html'
import { exportTarget, type ExportTargetAt } from './target'
import type { ExportReport, VariantOutcome } from './types'
import { ProviderFailure } from '@/main/providers/types'
import { AD_FAILURES, REPORT_NOT_SAVED } from '@/shared/export/messages'
import { reportNames, reportStamp } from '@/shared/export/output-paths'
import type { ReportAddReply } from '@/shared/schemas/commands/export'

const failure = (detail: string) => new ProviderFailure({ kind: 'other', detail })

type Files = { json: Uint8Array; html: Uint8Array }

// Both names at the first n where both are free: -2 ... -99 while either is taken. A name taken
// between exists() and writeNew moves both on too. Past -99, or on a disk error, the report
// fails with "The file could not be written."
async function writeFiles(target: ExportTargetAt, campaignId: string, stamp: string, f: Files) {
  try {
    for (let n = 1; ; n += 1) {
      const names = reportNames(stamp, n)
      if (!names) break
      const json = `${campaignId}/${names.json}`
      const html = `${campaignId}/${names.html}`
      if ((await target.exists(json)) || (await target.exists(html))) continue
      if ((await target.writeNew(json, f.json)) && (await target.writeNew(html, f.html))) return
    }
  } catch {
    throw failure(AD_FAILURES.notWritten)
  }
  throw failure(AD_FAILURES.notWritten)
}

function pictures(outcomes: VariantOutcome[]): Map<string, Uint8Array> {
  return new Map(outcomes.flatMap((o) => (o.picture ? [[o.variantId, o.picture] as const] : [])))
}

// deps: the finished CoreDeps, read when the port runs. The job's own target is not used: the
// report needs writeNew, which the shared ExportTarget shape does not have.
export function createExportReport(deps: () => CoreDeps): ExportReport {
  return {
    async write(jc, plan, _target, outcomes, checks) {
      const d = deps()
      const project = d.projects.requireOpen(plan.projectId)
      const facts = reportFacts(d, project, plan.campaignId)
      const now = d.now()
      const report = buildReport(facts, outcomes, {
        createdAt: now.toISOString(),
        root: plan.root,
        checksRun: d.export.checks.checksRun,
        checks,
        warningsSeen: plan.warningsSeen,
        proceeded: plan.proceeded,
      })
      const encode = (text: string) => new TextEncoder().encode(text)
      await writeFiles(exportTarget(plan.root), plan.campaignId, reportStamp(now), {
        json: encode(`${JSON.stringify(report, null, 2)}\n`),
        html: encode(reportHtml(report, pictures(outcomes))),
      })
      const saved = await jc.system('report.add', {
        projectId: plan.projectId,
        campaignId: plan.campaignId,
        outputDir: plan.root,
        report,
      })
      if (!saved.ok) throw failure(REPORT_NOT_SAVED)
      return (saved.data as ReportAddReply).reportId
    },
  }
}
