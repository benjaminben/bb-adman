// layer.setFonts (spec/phases/phase-06.md). A font per language (A-166). Agent policy allow. Stub
// (P6-1): refuses in prepare, before it reads or writes anything, until P6-9 replaces the body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import {
  layerSetFontsInput,
  type LayerSetFontsReply,
} from '@/shared/schemas/commands/language-font'
import { AppError } from '@/shared/schemas/result'

const NAME = 'layer.setFonts'
const notBuilt = () =>
  new AppError('RULE_VIOLATION', `${NAME} is not built yet.`, { reason: 'not_built' })

export function layerSetFonts(_deps: CoreDeps) {
  return defineCommand({
    name: NAME,
    input: layerSetFontsInput,
    projectId: (input) => input.projectId,
    prepare(): Promise<undefined> {
      return Promise.reject(notBuilt())
    },
    run(): HandlerResult<LayerSetFontsReply> {
      throw notBuilt()
    },
  })
}
