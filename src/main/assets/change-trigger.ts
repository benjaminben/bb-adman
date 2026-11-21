// When the app looks for linked files changed outside it (SPEC 14, Slice A rulings point 2b;
// FR-009, R-06): after a project opens and when a window gains focus. No Electron import;
// index.ts wires both triggers. project/open.ts is not edited.
import type { BusEvent, ExecuteOptions } from '@/main/commands/bus'
import type { ActivityLog } from '@/main/log/activity-log'
import type { Result } from '@/shared/schemas/result'

type Execute = (name: string, input: unknown, opts: ExecuteOptions) => Promise<Result<unknown>>

export type ChangeCheckDeps = {
  execute: Execute
  emit: (event: BusEvent) => void
  log: ActivityLog
}

// Projects with a check under way; a second check for one of them is not started.
const running = new Set<string>()

function logFailure(log: ActivityLog, level: 'warn' | 'error', projectId: string, why: string) {
  log.write({
    level,
    event: 'asset',
    name: 'asset.checkChanged',
    actor: 'system',
    ok: false,
    projectId,
    message: `The check for changed files did not finish: ${why}`,
  })
}

// Sends asset.checkChanged, then asset.changedOnDisk when any asset changed. Never throws.
export async function checkChangedFiles(deps: ChangeCheckDeps, projectId: string): Promise<void> {
  if (running.has(projectId)) return
  running.add(projectId)
  try {
    const result = await deps.execute('asset.checkChanged', { projectId }, { actor: 'user' })
    if (!result.ok) return logFailure(deps.log, 'warn', projectId, result.error.code)
    const { assetIds } = result.data as { assetIds: string[] }
    if (assetIds.length > 0) {
      deps.emit({ name: 'asset.changedOnDisk', payload: { projectId, assetIds } })
    }
  } catch {
    logFailure(deps.log, 'error', projectId, 'unexpected error')
  } finally {
    running.delete(projectId)
  }
}

// The same execute, which also starts a check, without waiting for it, after every
// project.open that succeeds.
export function withChangeChecks(
  execute: Execute,
  check: (projectId: string) => Promise<void>,
): Execute {
  return async (name, input, opts) => {
    const result = await execute(name, input, opts)
    if (name === 'project.open' && result.ok) {
      void check((result.data as { projectId: string }).projectId)
    }
    return result
  }
}
