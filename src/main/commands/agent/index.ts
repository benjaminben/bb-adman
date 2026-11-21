// The agent command domain (spec/phases/phase-10.md): the user's answer to an agent's ask.
import type { CommandHandler } from '@/main/commands/types'
import type { PermissionBroker } from '@/main/mcp/permissions'
import { agentAnswerPermission } from './answer-permission'

export function agentCommands(broker: PermissionBroker): CommandHandler[] {
  return [agentAnswerPermission(broker)]
}
