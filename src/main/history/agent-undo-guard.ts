// The agent undo guard (A-261). An agent command that would add the 101st agent entry in a row
// to one undo list is refused. The list is known only from the handler's result, so the check
// runs inside the handler's own transaction: the refusal rolls the write back.
import { AGENT_RUN_LIMIT, type UndoLists } from './undo-lists'
import type { CommandHandler } from '@/main/commands/types'
import type { ExecuteOptions } from '@/main/commands/bus'
import { AppError } from '@/shared/schemas/result'

const LIMIT_MESSAGE =
  'This ad has too many agent changes in a row. Ask the user to look before going on.'

export function guardAgentUndo(
  handler: CommandHandler,
  undo: UndoLists,
  projectId: string | null,
  opts: ExecuteOptions,
): CommandHandler {
  // The user is never refused. An agent's undo records a redo entry, never an undo entry.
  if (!projectId || opts.actor !== 'agent' || opts.replay?.direction === 'undo') return handler
  return {
    ...handler,
    run(ctx, input, prepared) {
      const result = handler.run(ctx, input, prepared)
      if (result instanceof Promise || !result.inverse) return result
      if (undo.agentRun(projectId, result.inverse.scope) >= AGENT_RUN_LIMIT) {
        throw new AppError('RULE_VIOLATION', LIMIT_MESSAGE, { reason: 'agent_undo_limit' })
      }
      return result
    },
  }
}
