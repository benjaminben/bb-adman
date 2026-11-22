// agent.askFiles (spec/phases/round-2-platform.md, D7): the full paths of an open import ask,
// for the permission dialog. User only: an agent is refused with AGENT_DENIED before its input
// is read, and no MCP tool calls it. The paths reach the window through this reply, never an
// event. The broker holds the list for the request's life only.
import { z } from 'zod'
import type { PermissionBroker } from '@/main/mcp/permissions'
import type { QueryFn } from './types'
import { AppError } from '@/shared/schemas/result'

export const ASK_FILES_DENIED =
  'Agents cannot read permission requests in this version. Ask the user to do it in the app.'

export const agentAskFilesInput = z.object({ requestId: z.string().min(1) }).strict()

// The reply while the request is open: the normalised paths, in order.
export type AskFiles = { files: string[] }

function agentAskFiles(broker: PermissionBroker): QueryFn {
  return (raw, opts): AskFiles => {
    if (opts.actor !== 'user') throw new AppError('AGENT_DENIED', ASK_FILES_DENIED)
    const parsed = agentAskFilesInput.safeParse(raw)
    if (!parsed.success) throw new AppError('INVALID_INPUT', 'Some values are not valid.')
    return { files: broker.files(parsed.data.requestId) }
  }
}

export function askFilesQueries(broker: PermissionBroker): Record<string, QueryFn> {
  return { 'agent.askFiles': agentAskFiles(broker) }
}
