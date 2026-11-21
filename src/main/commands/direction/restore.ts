// direction.restore (spec/links-and-sync.md): system command, the inverse of direction.delete only.
// Agent policy deny. Stub (P5-1, A-149): refuses in run until P5-11 replaces the body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { directionRestoreInput, type DirectionReply } from '@/shared/schemas/commands/direction'
import { AppError } from '@/shared/schemas/result'

export function directionRestore(_deps: CoreDeps) {
  return defineCommand({
    name: 'direction.restore',
    internal: true,
    input: directionRestoreInput,
    projectId: (input) => input.projectId,
    run(): HandlerResult<DirectionReply> {
      throw new AppError('RULE_VIOLATION', 'This is not built yet.', { reason: 'not_built' })
    },
  })
}
