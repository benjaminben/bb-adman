// variant.add (spec/links-and-sync.md): makes one variant from the master. Agent policy allow. Stub
// (P5-1, A-149): refuses in run until P5-10 replaces the body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { variantAddInput, type VariantReply } from '@/shared/schemas/commands/variant'
import { AppError } from '@/shared/schemas/result'

export function variantAdd(_deps: CoreDeps) {
  return defineCommand({
    name: 'variant.add',
    input: variantAddInput,
    projectId: (input) => input.projectId,
    run(): HandlerResult<VariantReply> {
      throw new AppError('RULE_VIOLATION', 'This is not built yet.', { reason: 'not_built' })
    },
  })
}
