import type { CoreDeps } from '../../core-deps'
import type { CommandHandler } from '../types'
import { comfyCheck } from './check'
import { comfySetAddress } from './set-address'

export function comfyCommands(deps: CoreDeps): CommandHandler[] {
  return [comfySetAddress(deps), comfyCheck(deps)]
}
