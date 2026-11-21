// report.list and report.get (spec/phases/phase-08.md "Report", queries). User only: an agent
// is refused before the input is read, since the answers hold the output folder's full path
// (A-196). Stub (P8-1): checks the input and the project, then answers no reports, until P8-9
// replaces the bodies.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn, QueryOptions } from './types'
import { openFor } from './campaign-reads'
import {
  reportGetInput,
  reportListInput,
  type ReportGetReply,
  type ReportListReply,
} from '@/shared/schemas/queries/report'
import { AppError } from '@/shared/schemas/result'
import { REPORT_NOT_FOUND, REPORT_QUERY_DENIED } from '@/shared/export/messages'

function requireUser(opts: QueryOptions): void {
  if (opts.actor !== 'user') throw new AppError('AGENT_DENIED', REPORT_QUERY_DENIED)
}

export function reportList(deps: Pick<CoreDeps, 'projects'>): QueryFn {
  return (raw, opts): ReportListReply => {
    requireUser(opts)
    openFor(deps, reportListInput, raw)
    return []
  }
}

export function reportGet(deps: Pick<CoreDeps, 'projects'>): QueryFn {
  return (raw, opts): ReportGetReply => {
    requireUser(opts)
    openFor(deps, reportGetInput, raw)
    throw new AppError('NOT_FOUND', REPORT_NOT_FOUND)
  }
}

export function reportQueries(deps: CoreDeps): Record<string, QueryFn> {
  return {
    'report.list': reportList(deps),
    'report.get': reportGet(deps),
  }
}
