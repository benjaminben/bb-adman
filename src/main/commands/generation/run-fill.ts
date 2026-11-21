// generation.runFill (spec/links-and-sync.md): extends a variant's background picture as a
// generative_fill job. Agent policy tick: a gate run command from P5-8. Stub (P5-1, A-149): refuses
// in prepare until P5-8 replaces the body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import {
  generationRunFillInput,
  type GenerationRunFillReply,
} from '@/shared/schemas/commands/generation'
import { AppError } from '@/shared/schemas/result'

export function generationRunFill(_deps: CoreDeps) {
  return defineCommand({
    name: 'generation.runFill',
    input: generationRunFillInput,
    projectId: (input) => input.projectId,
    async prepare(): Promise<never> {
      throw new AppError('RULE_VIOLATION', 'This is not built yet.', { reason: 'not_built' })
    },
    run(): HandlerResult<GenerationRunFillReply> {
      throw new AppError('RULE_VIOLATION', 'This is not built yet.', { reason: 'not_built' })
    },
  })
}
