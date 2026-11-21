// variant.restoreLayers (spec/links-and-sync.md): system command, the inverse of sync.apply and
// generation.applyFill. Agent policy deny. Stub (P5-1, A-149): refuses in run until P5-4 replaces
// the body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { variantRestoreLayersInput, type VariantsReply } from '@/shared/schemas/commands/variant'
import { AppError } from '@/shared/schemas/result'

export function variantRestoreLayers(_deps: CoreDeps) {
  return defineCommand({
    name: 'variant.restoreLayers',
    internal: true,
    input: variantRestoreLayersInput,
    projectId: (input) => input.projectId,
    run(): HandlerResult<VariantsReply> {
      throw new AppError('RULE_VIOLATION', 'This is not built yet.', { reason: 'not_built' })
    },
  })
}
