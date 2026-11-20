import type { CoreDeps } from '../../core-deps'
import type { CommandHandler } from '../types'
import { settingsUpdate } from './update'

export function settingsCommands(deps: CoreDeps): CommandHandler[] {
  return [settingsUpdate(deps)]
}
