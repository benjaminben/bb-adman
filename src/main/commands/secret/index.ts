import type { CoreDeps } from '../../core-deps'
import type { CommandHandler } from '../types'
import { secretSet } from './set'
import { secretDelete } from './delete'

export function secretCommands(deps: CoreDeps): CommandHandler[] {
  return [secretSet(deps), secretDelete(deps)]
}
