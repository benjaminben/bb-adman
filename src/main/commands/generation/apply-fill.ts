// generation.applyFill (spec/links-and-sync.md): places a finished fill on its targets. Agent
// policy deny. Stub (P5-1, A-149): refuses in run until P5-9 replaces the body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import {
  generationApplyFillInput,
  type GenerationApplyFillReply,
} from '@/shared/schemas/commands/generation'
import { AppError } from '@/shared/schemas/result'

export function generationApplyFill(_deps: CoreDeps) {
  return defineCommand({
    name: 'generation.applyFill',
    input: generationApplyFillInput,
    projectId: (input) => input.projectId,
    run(): HandlerResult<GenerationApplyFillReply> {
      throw new AppError('RULE_VIOLATION', 'This is not built yet.', { reason: 'not_built' })
    },
  })
}
