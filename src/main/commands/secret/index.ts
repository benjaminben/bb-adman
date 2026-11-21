import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'
import { secretSet } from './set'
import { secretDelete } from './delete'

export function secretCommands(deps: CoreDeps): CommandHandler[] {
  return [secretSet(deps), secretDelete(deps)]
}
