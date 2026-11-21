// variant.remove (spec/links-and-sync.md): system command, the inverse of fan-out, variant.add and
// variant.restore. Agent policy deny. Stub (P5-1, A-149): refuses in run until P5-4 replaces the
// body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { variantRemoveInput, type VariantsReply } from '@/shared/schemas/commands/variant'
import { AppError } from '@/shared/schemas/result'

export function variantRemove(_deps: CoreDeps) {
  return defineCommand({
    name: 'variant.remove',
    internal: true,
    input: variantRemoveInput,
    projectId: (input) => input.projectId,
    run(): HandlerResult<VariantsReply> {
      throw new AppError('RULE_VIOLATION', 'This is not built yet.', { reason: 'not_built' })
    },
  })
}
