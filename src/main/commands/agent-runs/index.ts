import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'
import { agentRunsSetAllowed } from './set-allowed'
import { agentRunsSetLimit } from './set-limit'

export function agentRunsCommands(deps: CoreDeps): CommandHandler[] {
  return [agentRunsSetAllowed(deps), agentRunsSetLimit(deps)]
}
