import type { CoreDeps } from '../../core-deps'
import type { CommandHandler } from '../types'
import { comfySetAddress } from './set-address'

export function comfyCommands(deps: CoreDeps): CommandHandler[] {
  return [comfySetAddress(deps)]
}
