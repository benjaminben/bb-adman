import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'
import { comfyCheck } from './check'
import { comfySetAddress } from './set-address'
import { comfyWorkflowAdd, comfyWorkflowAddFromFile } from './workflow-add'
import { comfyWorkflowRemove } from './workflow-remove'
import { comfyWorkflowUpdate } from './workflow-update'

export function comfyCommands(deps: CoreDeps): CommandHandler[] {
  return [
    comfySetAddress(deps),
    comfyCheck(deps),
    comfyWorkflowAddFromFile(deps),
    comfyWorkflowAdd(deps),
    comfyWorkflowUpdate(deps),
    comfyWorkflowRemove(deps),
  ]
}
