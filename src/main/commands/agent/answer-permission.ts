// agent.answerPermission (spec/phases/phase-10.md, ask flow). App scope, user only: its agent
// policy row is deny, so the bus refuses an agent before the input is read, and no tool runs
// it. The broker decides what an answer does; the stub broker knows no request.
import { defineCommand } from '@/main/commands/types'
import type { PermissionBroker } from '@/main/mcp/permissions'
import { agentAnswerPermissionInput } from '@/shared/schemas/commands/agent'

export function agentAnswerPermission(broker: PermissionBroker) {
  return defineCommand({
    name: 'agent.answerPermission',
    input: agentAnswerPermissionInput,
    run(_ctx, input) {
      broker.answer(input)
      return { data: null }
    },
  })
}
