// report.list and report.get (spec/phases/phase-08.md "Report", queries). User only: an agent
// is refused before the input is read, since the answers hold the output folder's full path
// (A-196). A row comes from a project file that may be someone else's, so its body and folder
// are checked before they are given: a row that fails is logged with no values and left out
// (list) or NOT_FOUND (get).
import { z } from 'zod'
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn, QueryOptions } from './types'
import { openFor, requireCampaign } from './campaign-reads'
import {
  reportGetInput,
  reportListInput,
  type ReportGetReply,
  type ReportListReply,
} from '@/shared/schemas/queries/report'
import { Report } from '@/shared/schemas/report'
import { AppError } from '@/shared/schemas/result'
import { REPORT_NOT_FOUND, REPORT_QUERY_DENIED } from '@/shared/export/messages'

type ReportDeps = Pick<CoreDeps, 'projects' | 'log'>
type StoredRow = { id: string; output_dir: string; body: string }
type ReadRow = { reportId: string; outputDir: string; report: Report }

// The output folder rule's own limit (export.run's outputDir).
const OutputDir = z.string().min(1).max(4096)

function requireUser(opts: QueryOptions): void {
  if (opts.actor !== 'user') throw new AppError('AGENT_DENIED', REPORT_QUERY_DENIED)
}

function parseBody(body: string): Report | null {
  try {
    const parsed = Report.safeParse(JSON.parse(body))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

// Null for a row that fails, after one warn line that names the project only.
function readRow(deps: ReportDeps, projectId: string, row: StoredRow): ReadRow | null {
  const report = parseBody(row.body)
  if (report && OutputDir.safeParse(row.output_dir).success) {
    return { reportId: row.id, outputDir: row.output_dir, report }
  }
  deps.log.write({
    level: 'warn',
    event: 'query',
    name: 'report',
    actor: 'user',
    ok: false,
    projectId,
    message: 'A saved report could not be read.',
  })
  return null
}

// The time shown is the body's, which the schema has checked (the row's copy is the same).
const COLUMNS = 'id, output_dir, body'

export function reportList(deps: ReportDeps): QueryFn {
  return (raw, opts): ReportListReply => {
    requireUser(opts)
    const { input, project } = openFor(deps, reportListInput, raw)
    requireCampaign(project.db, input.campaignId)
    const rows = project.db
      .prepare<[string], StoredRow>(
        `SELECT ${COLUMNS} FROM report WHERE campaign_id = ? ORDER BY created_at DESC, id DESC`,
      )
      .all(input.campaignId)
    return rows.flatMap((stored) => {
      const row = readRow(deps, input.projectId, stored)
      if (!row) return []
      const { reportId, outputDir, report } = row
      const { createdAt, exportNumber, summary } = report
      return [{ reportId, createdAt, exportNumber, outputDir, summary }]
    })
  }
}

export function reportGet(deps: ReportDeps): QueryFn {
  return (raw, opts): ReportGetReply => {
    requireUser(opts)
    const { input, project } = openFor(deps, reportGetInput, raw)
    const stored = project.db
      .prepare<[string], StoredRow>(`SELECT ${COLUMNS} FROM report WHERE id = ?`)
      .get(input.reportId)
    const row = stored && readRow(deps, input.projectId, stored)
    if (!row) throw new AppError('NOT_FOUND', REPORT_NOT_FOUND)
    return { report: row.report, outputDir: row.outputDir }
  }
}

export function reportQueries(deps: CoreDeps): Record<string, QueryFn> {
  return {
    'report.list': reportList(deps),
    'report.get': reportGet(deps),
  }
}
