// The query runner (SPEC 4.3, 12). It merges the domain maps, one line per domain.
import { ulid } from 'ulid'
import type { CoreDeps } from '@/main/core-deps'
import type { ActivityLog } from '@/main/log/activity-log'
import { errorContext } from '@/main/log/error-context'
import { appQueries } from './app'
import { approvalsQueries } from './approvals'
import { assetQueries } from './asset'
import { campaignQueries } from './campaign'
import { checkQueries } from './check'
import { comfyQueries } from './comfy'
import { comfyWorkflowQueries } from './comfy-workflow'
import { activityQueries } from './activity'
import { askFilesQueries } from './ask-files'
import { askWorkflowQueries } from './ask-workflow'
import type { PermissionBroker } from '@/main/mcp/permissions'
import { earlierOptionsQueries } from './earlier-options'
import { historyQueries } from './history'
import { jobQueries } from './job'
import { jobGetQueries } from './job-get'
import { jobServerMessageQueries } from './job-server-message'
import { mcpQueries, type McpState } from './mcp'
import { paidCountQueries } from './paid-count'
import { projectQueries } from './project'
import { projectListOpenQueries } from './project-list-open'
import { publishQueries } from './publish'
import { renderQueries } from './render'
import { reportQueries } from './report'
import { subjectListQueries } from './subject-list'
import { syncQueries } from './sync'
import { templateQueries } from './template'
import { translationQueries, translationSourceQueries } from './translation'
import { variantQueries } from './variant'
import type { QueryFn, QueryOptions } from './types'
import { AppError, fail, internalError, ok, type Result } from '@/shared/schemas/result'

export type { QueryFn, QueryOptions }

// Every registered query by name. mcp.getConnectInfo needs the MCP service, and agent.askFiles
// and agent.askWorkflow the permission broker, so each is registered only when core passes it
// (a unit test builds the table without them).
export function queryTable(
  deps: CoreDeps,
  mcp?: McpState,
  broker?: PermissionBroker,
): Record<string, QueryFn> {
  return {
    ...appQueries(deps),
    ...approvalsQueries(deps),
    ...assetQueries(deps),
    ...campaignQueries(deps),
    ...checkQueries(deps),
    ...comfyQueries(deps),
    ...comfyWorkflowQueries(deps),
    ...historyQueries(deps),
    ...jobQueries(deps),
    ...jobGetQueries(deps),
    ...jobServerMessageQueries(deps),
    ...earlierOptionsQueries(deps),
    ...activityQueries(deps),
    ...(broker ? askFilesQueries(broker) : {}),
    ...(broker ? askWorkflowQueries(broker) : {}),
    ...paidCountQueries(deps),
    ...(mcp ? mcpQueries(deps, mcp) : {}),
    ...projectQueries(deps),
    ...projectListOpenQueries(deps),
    ...publishQueries(deps),
    ...renderQueries(deps),
    ...reportQueries(deps),
    ...subjectListQueries(deps),
    ...syncQueries(deps),
    ...templateQueries(deps),
    ...translationQueries(deps),
    ...translationSourceQueries(deps),
    ...variantQueries(deps),
  }
}

export function createQueries(deps: CoreDeps, mcp?: McpState) {
  return createQueryRunner(queryTable(deps, mcp), deps.log)
}

// The runner (SPEC 4.3): finds the query, never throws, returns INTERNAL for anything
// unforeseen.
export function createQueryRunner(table: Record<string, QueryFn>, log: ActivityLog) {
  return async function query(
    name: string,
    input: unknown,
    opts: QueryOptions,
  ): Promise<Result<unknown>> {
    const fn = table[name]
    if (!fn) return fail({ code: 'INVALID_INPUT', message: `Unknown query: ${name}` })
    try {
      return ok(await fn(input, opts))
    } catch (e) {
      if (e instanceof AppError) return fail(e.toBody())
      // Like the bus, the runner never throws (SPEC 4.3). A query has no command, so the
      // reply and the log line share an ID made here.
      const body = internalError(ulid())
      log.write({
        level: 'error',
        event: 'query',
        name,
        actor: opts.actor,
        ok: false,
        errorKind: 'INTERNAL',
        message: body.message,
        context: { commandId: body.details?.commandId, error: errorContext(e) },
      })
      return fail(body)
    }
  }
}
