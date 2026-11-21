// direction.rename (spec/links-and-sync.md): a new name, unique in the campaign ignoring case.
// Agent policy deny. Stub (P5-1, A-149): refuses in run until P5-11 replaces the body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { directionRenameInput, type DirectionReply } from '@/shared/schemas/commands/direction'
import { AppError } from '@/shared/schemas/result'

export function directionRename(_deps: CoreDeps) {
  return defineCommand({
    name: 'direction.rename',
    input: directionRenameInput,
    projectId: (input) => input.projectId,
    run(): HandlerResult<DirectionReply> {
      throw new AppError('RULE_VIOLATION', 'This is not built yet.', { reason: 'not_built' })
    },
  })
}
