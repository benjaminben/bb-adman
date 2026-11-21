// The query runner (SPEC 4.3, 12). It merges the domain maps, one line per domain.
import { ulid } from 'ulid'
import type { CoreDeps } from '../core-deps'
import type { ActivityLog } from '../log/activity-log'
import { errorContext } from '../log/error-context'
import { appQueries } from './app'
import { assetQueries } from './asset'
import { campaignQueries } from './campaign'
import { comfyQueries } from './comfy'
import { historyQueries } from './history'
import { jobQueries } from './job'
import { jobServerMessageQueries } from './job-server-message'
import { projectQueries } from './project'
import { templateQueries } from './template'
import type { QueryFn, QueryOptions } from './types'
import { AppError, fail, internalError, ok, type Result } from '../../shared/schemas/result'

export type { QueryFn, QueryOptions }

export function createQueries(deps: CoreDeps) {
  return createQueryRunner(
    {
      ...appQueries(deps),
      ...assetQueries(deps),
      ...campaignQueries(deps),
      ...comfyQueries(deps),
      ...historyQueries(deps),
      ...jobQueries(deps),
      ...jobServerMessageQueries(deps),
      ...projectQueries(deps),
      ...templateQueries(deps),
    },
    deps.log,
  )
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
