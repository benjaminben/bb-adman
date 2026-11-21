import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'
import { comfyCheck } from './check'
import { comfySetAddress } from './set-address'

export function comfyCommands(deps: CoreDeps): CommandHandler[] {
  return [comfySetAddress(deps), comfyCheck(deps)]
}
