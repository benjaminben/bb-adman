// direction.createFromMaster (spec/links-and-sync.md): a new direction from a master, its copy as
// the new master. Agent policy deny. Stub (P5-1, A-149): refuses in run until P5-11 replaces the
// body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import {
  directionCreateFromMasterInput,
  type DirectionCreateReply,
} from '@/shared/schemas/commands/direction'
import { AppError } from '@/shared/schemas/result'

export function directionCreateFromMaster(_deps: CoreDeps) {
  return defineCommand({
    name: 'direction.createFromMaster',
    input: directionCreateFromMasterInput,
    projectId: (input) => input.projectId,
    run(): HandlerResult<DirectionCreateReply> {
      throw new AppError('RULE_VIOLATION', 'This is not built yet.', { reason: 'not_built' })
    },
  })
}
