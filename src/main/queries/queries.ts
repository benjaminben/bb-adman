// Read-only queries (SPEC 4.3). Phase 1: app.getState and history.state.
import type { ProjectRegistry } from '../db/project-registry'
import type { SettingsStore } from '../settings/settings-store'
import type { SecretStore } from '../secrets/secret-store'
import type { UndoLists } from '../history/undo-lists'
import type { ActivityLog } from '../log/activity-log'
import { errorContext } from '../log/error-context'
import { historyInput } from '../../shared/schemas/commands/history'
import type { AppState, HistoryState, ProviderInfo } from '../../shared/schemas/queries'
import { ulid } from 'ulid'
import { AppError, fail, internalError, ok, type Result } from '../../shared/schemas/result'
import type { Actor } from '../../shared/schemas/events'

export type QueryDeps = {
  projects: ProjectRegistry
  settings: SettingsStore
  secrets: SecretStore
  undo: UndoLists
  providers: ProviderInfo[]
  log: ActivityLog
}

// Queries carry an actor set like a command's (SPEC 4.1). No Phase 1 query checks it;
// mcp.getConnectInfo (Phase 10) refuses the agent.
export type QueryOptions = { actor: Actor }

export type QueryFn = (input: unknown, opts: QueryOptions) => unknown | Promise<unknown>

export function createQueries(deps: QueryDeps) {
  const table: Record<string, QueryFn> = {
    'app.getState': (): AppState => {
      const settings = deps.settings.get()
      return {
        settings,
        recentProjects: settings.recentProjects,
        openProjects: deps.projects.summaries(),
        providers: deps.providers,
        secrets: deps.secrets.summaries(),
      }
    },
    'history.state': (raw): HistoryState => {
      const parsed = historyInput.safeParse(raw)
      if (!parsed.success) throw new AppError('INVALID_INPUT', 'Some values are not valid.')
      const { projectId, scope } = parsed.data
      deps.projects.requireOpen(projectId)
      return deps.undo.state(projectId, scope)
    },
  }

  return createQueryRunner(table, deps.log)
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
        event: 'app',
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
