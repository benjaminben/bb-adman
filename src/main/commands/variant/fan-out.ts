// variant.fanOut (spec/links-and-sync.md): makes the missing variants of a direction from its
// master. Agent policy deny. Stub (P5-1, A-149): refuses in run until P5-10 replaces the body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { variantFanOutInput, type VariantFanOutReply } from '@/shared/schemas/commands/variant'
import { AppError } from '@/shared/schemas/result'

export function variantFanOut(_deps: CoreDeps) {
  return defineCommand({
    name: 'variant.fanOut',
    input: variantFanOutInput,
    projectId: (input) => input.projectId,
    run(): HandlerResult<VariantFanOutReply> {
      throw new AppError('RULE_VIOLATION', 'This is not built yet.', { reason: 'not_built' })
    },
  })
}
