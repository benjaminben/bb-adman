// Work an approvals command does once its transaction has committed (AP-8 review N3, N6):
// sending approvals.changed and forgetting a password. A project-scope run is synchronous and
// its transaction commits or rolls back before the current task ends, so a microtask queued in
// run sees the outcome. `committed` reads the local tables to confirm the writes are there; a
// rolled-back run does nothing. A failure is logged by kind, with no values.
import type { ActivityLog } from '@/main/log/activity-log'
import { AppError } from '@/shared/schemas/result'

export function afterCommit(
  log: ActivityLog,
  ids: { projectId: string; campaignId: string; command: string },
  committed: () => boolean,
  then: () => void,
): void {
  queueMicrotask(() => {
    try {
      if (committed()) then()
    } catch (error) {
      log.write({
        level: 'warn',
        event: 'command',
        name: ids.command,
        actor: 'system',
        ok: false,
        projectId: ids.projectId,
        campaignId: ids.campaignId,
        errorKind: error instanceof AppError ? error.code : 'other',
        message: 'A step after an approvals command could not be finished.',
        context: { step: 'afterCommit' },
      })
    }
  })
}
