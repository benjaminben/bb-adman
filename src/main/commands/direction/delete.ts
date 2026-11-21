// direction.delete (spec/links-and-sync.md): deletes a direction and its variants. Agent policy
// deny. Stub (P5-1, A-149): refuses in run until P5-11 replaces the body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { directionDeleteInput, type DirectionReply } from '@/shared/schemas/commands/direction'
import { AppError } from '@/shared/schemas/result'

export function directionDelete(_deps: CoreDeps) {
  return defineCommand({
    name: 'direction.delete',
    input: directionDeleteInput,
    projectId: (input) => input.projectId,
    run(): HandlerResult<DirectionReply> {
      throw new AppError('RULE_VIOLATION', 'This is not built yet.', { reason: 'not_built' })
    },
  })
}
