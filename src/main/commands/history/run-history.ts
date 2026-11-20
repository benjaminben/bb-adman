// history.undo and history.redo (SPEC 4.2). The bus has already validated the input and
// found the project. Replays the stored inverse through the bus, so it gets the same
// validation, transaction, events and log as any edit.
import type { HistoryInput } from '../../../shared/schemas/commands/history'
import { AppError, type Result } from '../../../shared/schemas/result'
import type { UndoLists } from '../../history/undo-lists'
import type { ExecuteOptions } from '../bus'

type Deps = {
  undo: UndoLists
  execute: (name: string, input: unknown, opts: ExecuteOptions) => Promise<Result<unknown>>
}

export async function runHistory(
  name: 'history.undo' | 'history.redo',
  input: HistoryInput,
  opts: ExecuteOptions,
  deps: Deps,
): Promise<unknown> {
  const { projectId, scope } = input
  const direction = name === 'history.undo' ? 'undo' : 'redo'

  const take = direction === 'undo' ? deps.undo.takeUndo : deps.undo.takeRedo
  const call = take(projectId, scope)
  if (!call) {
    throw new AppError('RULE_VIOLATION', `Nothing to ${direction}.`, {
      reason: `nothing_to_${direction}`,
    })
  }

  const result = await deps.execute(call.name, call.input, {
    actor: opts.actor,
    agentClient: opts.agentClient,
    replay: { direction, projectId, scope },
  })
  if (!result.ok) {
    // Put the entry back in the same place; the other list is not touched (SPEC 4.2).
    if (direction === 'undo') deps.undo.record(projectId, scope, call, { fromRedo: true })
    else deps.undo.recordRedo(projectId, scope, call)
    throw new AppError(result.error.code, result.error.message, result.error.details)
  }
  return result.data
}
