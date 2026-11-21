// app.getState (SPEC 4.3). Settings, recent and open projects, providers, and secret
// summaries with their last four characters only.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import type { AppState } from '@/shared/schemas/queries/app'

export function appQueries(deps: CoreDeps): Record<string, QueryFn> {
  return {
    'app.getState': (): AppState => {
      const settings = deps.settings.get()
      return {
        settings,
        recentProjects: settings.recentProjects,
        openProjects: deps.projects.summaries(),
        providers: deps.providers,
        secrets: deps.secrets.summaries(),
        devTools: deps.devTools,
      }
    },
  }
}
