// agent.askFiles (spec/phases/round-2-platform.md, D7): the full paths of an open import ask,
// for the permission dialog. User only: an agent is refused with AGENT_DENIED before its input
// is read, and no MCP tool calls it. The paths reach the window through this reply, never an
// event. R2P-1 registers it against this stub, which knows no request; R2P-5 reads the broker.
import { z } from 'zod'
import type { PermissionBroker } from '@/main/mcp/permissions'
import { REQUEST_ENDED } from '@/main/mcp/permissions'
import type { QueryFn } from './types'
import { AppError } from '@/shared/schemas/result'

export const ASK_FILES_DENIED =
  'Agents cannot read permission requests in this version. Ask the user to do it in the app.'

export const agentAskFilesInput = z.object({ requestId: z.string().min(1) }).strict()

// The reply while the request is open: the normalised paths, in order.
export type AskFiles = { files: string[] }

function agentAskFiles(): QueryFn {
  return (raw, opts): AskFiles => {
    if (opts.actor !== 'user') throw new AppError('AGENT_DENIED', ASK_FILES_DENIED)
    if (!agentAskFilesInput.safeParse(raw).success) {
      throw new AppError('INVALID_INPUT', 'Some values are not valid.')
    }
    throw new AppError('NOT_FOUND', REQUEST_ENDED)
  }
}

export function askFilesQueries(_broker: PermissionBroker): Record<string, QueryFn> {
  return { 'agent.askFiles': agentAskFiles() }
}
