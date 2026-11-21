// sync.apply (spec/links-and-sync.md): writes the accepted master changes to a direction's
// variants. Agent policy deny. Stub (P5-1, A-149): refuses in run until P5-13 replaces the body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { syncApplyInput, type SyncApplyReply } from '@/shared/schemas/commands/sync'
import { AppError } from '@/shared/schemas/result'

export function syncApply(_deps: CoreDeps) {
  return defineCommand({
    name: 'sync.apply',
    input: syncApplyInput,
    projectId: (input) => input.projectId,
    run(): HandlerResult<SyncApplyReply> {
      throw new AppError('RULE_VIOLATION', 'This is not built yet.', { reason: 'not_built' })
    },
  })
}
