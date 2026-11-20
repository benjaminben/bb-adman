// Read-only queries (SPEC 4.3). Phase 1: app.getState and history.state.
import type { ProjectRegistry } from '../db/project-registry'
import type { SettingsStore } from '../settings/settings-store'
import type { SecretStore } from '../secrets/secret-store'
import type { UndoLists } from '../history/undo-lists'
import { historyInput } from '../../shared/schemas/commands/history'
import type { AppState, HistoryState, ProviderInfo } from '../../shared/schemas/queries'
import { AppError, fail, ok, type Result } from '../../shared/schemas/result'
import type { Actor } from '../../shared/schemas/events'

export type QueryDeps = {
  projects: ProjectRegistry
  settings: SettingsStore
  secrets: SecretStore
  undo: UndoLists
  providers: ProviderInfo[]
}

// Queries carry an actor set like a command's (SPEC 4.1). No Phase 1 query checks it;
// mcp.getConnectInfo (Phase 10) refuses the agent.
export type QueryOptions = { actor: Actor }

type QueryFn = (input: unknown, opts: QueryOptions) => unknown

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
      const { scope } = parsed.data
      const owners = deps.undo.projectsWithScope(scope).filter((id) => deps.projects.get(id))
      const states = owners.map((id) => deps.undo.state(id, scope))
      return {
        canUndo: states.some((s) => s.canUndo),
        canRedo: states.some((s) => s.canRedo),
      }
    },
  }

  return async function query(
    name: string,
    input: unknown,
    opts: QueryOptions,
  ): Promise<Result<unknown>> {
    const fn = table[name]
    if (!fn) return fail({ code: 'INVALID_INPUT', message: `Unknown query: ${name}` })
    try {
      return ok(fn(input, opts))
    } catch (e) {
      if (e instanceof AppError) return fail(e.toBody())
      throw e
    }
  }
}
