// history.undo and history.redo (SPEC 4.2). Replays the stored inverse command
// through the bus, so it gets the same transaction, events and log as any edit.
import { historyInput } from '../../../shared/schemas/commands/history'
import { AppError, type Result } from '../../../shared/schemas/result'
import type { ProjectRegistry } from '../../db/project-registry'
import type { UndoLists } from '../../history/undo-lists'
import type { ExecuteOptions } from '../bus'

type Deps = {
  undo: UndoLists
  projects: ProjectRegistry
  execute: (name: string, input: unknown, opts: ExecuteOptions) => Promise<Result<unknown>>
}

export async function runHistory(
  name: 'history.undo' | 'history.redo',
  raw: unknown,
  opts: ExecuteOptions,
  deps: Deps,
): Promise<{ projectId: string; data: unknown }> {
  const parsed = historyInput.safeParse(raw)
  if (!parsed.success) throw new AppError('INVALID_INPUT', 'Some values are not valid.')
  const { scope } = parsed.data
  const direction = name === 'history.undo' ? 'undo' : 'redo'
  const nothing = direction === 'undo' ? 'Nothing to undo.' : 'Nothing to redo.'

  // The input names only the scope, so find the open project that holds its list.
  const owners = deps.undo.projectsWithScope(scope).filter((id) => deps.projects.get(id))
  const projectId = owners.find((id) => {
    const state = deps.undo.state(id, scope)
    return direction === 'undo' ? state.canUndo : state.canRedo
  })
  if (!projectId) throw new AppError('RULE_VIOLATION', nothing)

  const take = direction === 'undo' ? deps.undo.takeUndo : deps.undo.takeRedo
  const call = take(projectId, scope)
  if (!call) throw new AppError('RULE_VIOLATION', nothing)

  const result = await deps.execute(call.name, call.input, {
    actor: opts.actor,
    agentClient: opts.agentClient,
    replay: { direction, projectId, scope },
  })
  if (!result.ok) {
    // Put the entry back so the user can try again after fixing the cause.
    if (direction === 'undo') deps.undo.record(projectId, scope, call, { fromRedo: true })
    else deps.undo.recordRedo(projectId, scope, call)
    throw new AppError(result.error.code, result.error.message, result.error.details)
  }
  return { projectId, data: result.data }
}
