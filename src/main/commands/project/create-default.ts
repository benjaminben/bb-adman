// project.createInDefaultFolder (spec/phases/round-2-platform.md, D8): a new project in the
// default projects folder; the input names no place. R2P-1 registers it against this stub,
// which refuses before it touches the disk; R2P-8 builds it.
import { defineCommand } from '@/main/commands/types'
import { projectCreateDefaultInput } from '@/shared/schemas/commands/project-default'
import { AppError } from '@/shared/schemas/result'

export function projectCreateInDefaultFolder() {
  return defineCommand({
    name: 'project.createInDefaultFolder',
    input: projectCreateDefaultInput,
    changesAppState: true,
    run(): never {
      throw new AppError('RULE_VIOLATION', 'This is not built yet.', { reason: 'not_built' })
    },
  })
}
