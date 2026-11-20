// Runs a project-scope handler (SPEC 3.6): prepare outside the transaction, check the
// project is still open, run inside one transaction, read back the rows the handler named
// (SPEC 4.4), and undo the prepare step if run throws.
import type { BaseContext, CommandHandler, HandlerResult } from './types'
import { createChangeRecorder, type ProjectChanges } from './change-recorder'
import type { ProjectRegistry } from '../db/project-registry'

export type ProjectRun = { result: HandlerResult<unknown>; changes: ProjectChanges | null }

export async function runInProject(
  projects: ProjectRegistry,
  handler: CommandHandler,
  input: unknown,
  base: BaseContext,
  projectId: string,
): Promise<ProjectRun> {
  const prepareCtx = {
    actor: base.actor,
    commandId: base.commandId,
    project: projects.requireOpen(projectId),
  }
  const prepared = handler.prepare ? await handler.prepare(prepareCtx, input) : undefined
  try {
    const project = projects.requireOpen(projectId)
    const changes = createChangeRecorder()
    return project.db.transaction(() => {
      const result = handler.run({ ...base, project, changes }, input, prepared)
      if (result instanceof Promise) throw new Error(`${handler.name} must run synchronously`)
      return { result, changes: changes.read(project.db) }
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
