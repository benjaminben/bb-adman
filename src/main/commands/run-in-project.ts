// Runs a project-scope handler (SPEC 3.6): prepare outside the transaction, check the
// project is still open, run inside one transaction, and undo the prepare step if run throws.
import type { BaseContext, CommandHandler, HandlerResult } from './types'
import type { ProjectRegistry } from '../db/project-registry'

export async function runInProject(
  projects: ProjectRegistry,
  handler: CommandHandler,
  input: unknown,
  base: BaseContext,
  projectId: string,
): Promise<HandlerResult<unknown>> {
  const prepareCtx = {
    actor: base.actor,
    commandId: base.commandId,
    project: projects.requireOpen(projectId),
  }
  const prepared = handler.prepare ? await handler.prepare(prepareCtx, input) : undefined
  try {
    const project = projects.requireOpen(projectId)
    return project.db.transaction(() => {
      const out = handler.run({ ...base, project }, input, prepared)
      if (out instanceof Promise) throw new Error(`${handler.name} must run synchronously`)
      return out
    })()
  } catch (e) {
    await undoPrepare(handler, prepared)
    throw e
  }
}

// A file left over by a failed undoPrepare is harmless (SPEC 3.6), so its own failure
// does not replace the error that stopped the command.
async function undoPrepare(handler: CommandHandler, prepared: unknown): Promise<void> {
  if (!handler.undoPrepare) return
  try {
    await handler.undoPrepare(prepared)
  } catch {
    return
  }
}
