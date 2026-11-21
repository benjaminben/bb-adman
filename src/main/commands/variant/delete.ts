// variant.delete (spec/links-and-sync.md): deletes one variant that is not a master. Agent policy
// ask [FR-197]. Stub (P5-1, A-149): refuses in run until P5-4 replaces the body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { variantDeleteInput, type VariantReply } from '@/shared/schemas/commands/variant'
import { AppError } from '@/shared/schemas/result'

export function variantDelete(_deps: CoreDeps) {
  return defineCommand({
    name: 'variant.delete',
    input: variantDeleteInput,
    projectId: (input) => input.projectId,
    run(): HandlerResult<VariantReply> {
      throw new AppError('RULE_VIOLATION', 'This is not built yet.', { reason: 'not_built' })
    },
  })
}
