// agent.askWorkflow (spec/comfyui-custom.md "Commands, queries and events", D-104, CW-6a):
// the name, job, start, reference count and node types of an open workflow ask, for the permission dialog. User
// only: an agent is refused with AGENT_DENIED before its input is read, and no MCP tool calls
// it (rule 7). The node types reach the window through this reply, never an event. The broker
// holds them for the ask's life only; after it ends, NOT_FOUND "That request has ended."
import { z } from 'zod'
import type { PermissionBroker } from '@/main/mcp/permissions'
import type { AskWorkflowReply } from '@/main/mcp/ask-workflow-reader'
import type { QueryFn } from './types'
import { AppError } from '@/shared/schemas/result'
import { ASK_FILES_DENIED } from './ask-files'

export type { AskWorkflowReply }

export const agentAskWorkflowInput = z.object({ requestId: z.string().min(1) }).strict()

function agentAskWorkflow(broker: PermissionBroker): QueryFn {
  return (raw, opts): AskWorkflowReply => {
    if (opts.actor !== 'user') throw new AppError('AGENT_DENIED', ASK_FILES_DENIED)
    const parsed = agentAskWorkflowInput.safeParse(raw)
    if (!parsed.success) throw new AppError('INVALID_INPUT', 'Some values are not valid.')
    return broker.workflow(parsed.data.requestId)
  }
}

export function askWorkflowQueries(broker: PermissionBroker): Record<string, QueryFn> {
  return { 'agent.askWorkflow': agentAskWorkflow(broker) }
}
