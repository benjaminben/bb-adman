// history.state (SPEC 4.2, 4.3): whether undo and redo are available for one scope of the
// named project. Nothing searches other projects.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import { historyStateInput, type HistoryState } from '@/shared/schemas/queries/history'
import { AppError } from '@/shared/schemas/result'

export function historyQueries(deps: CoreDeps): Record<string, QueryFn> {
  return {
    'history.state': (raw): HistoryState => {
      const parsed = historyStateInput.safeParse(raw)
      if (!parsed.success) throw new AppError('INVALID_INPUT', 'Some values are not valid.')
      const { projectId, scope } = parsed.data
      deps.projects.requireOpen(projectId)
      return deps.undo.state(projectId, scope)
    },
  }
}
