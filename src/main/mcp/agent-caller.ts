// The only way the MCP server reaches core (SPEC 4.1, 5.2). The actor is fixed here as
// 'agent'; no input, header or tool argument can change it. Agent policy stays in the bus
// and in each query.
import type { ExecuteOptions } from '@/main/commands/bus'
import type { QueryOptions } from '@/main/queries/queries'
import type { Result } from '@/shared/schemas/result'

export type CoreTargets = {
  execute(name: string, input: unknown, opts: ExecuteOptions): Promise<Result<unknown>>
  query(name: string, input: unknown, opts: QueryOptions): Promise<Result<unknown>>
}

export type AgentCaller = {
  execute(name: string, input: unknown): Promise<Result<unknown>>
  query(name: string, input: unknown): Promise<Result<unknown>>
}

export function agentCaller(core: CoreTargets): AgentCaller {
  return {
    execute: (name, input) => core.execute(name, input, { actor: 'agent' }),
    query: (name, input) => core.query(name, input, { actor: 'agent' }),
  }
}
