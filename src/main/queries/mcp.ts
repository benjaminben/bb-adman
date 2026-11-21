// mcp.getConnectInfo (SPEC 4.3, 5.3, 6.8; FR-191, R-10, D-014). User-only: an agent is
// refused with AGENT_DENIED and gets nothing. No MCP tool calls it.
import type { CoreDeps } from '../core-deps'
import type { QueryFn } from './types'
import type { ConnectInfo, McpProblem } from '../../shared/schemas/queries/mcp'
import { AppError } from '../../shared/schemas/result'

export const CONNECT_INFO_DENIED =
  'Agents cannot read the agent access settings in this version. Ask the user to do it in the app.'

// What the query needs from the MCP service (SPEC 14 1.58 J-8, J-11).
export type McpState = { running: () => boolean; problem: () => McpProblem }

type Deps = Pick<CoreDeps, 'settings' | 'secrets'>

export function mcpGetConnectInfo(deps: Deps, mcp: McpState): QueryFn {
  return (_input, opts): ConnectInfo => {
    if (opts.actor !== 'user') throw new AppError('AGENT_DENIED', CONNECT_INFO_DENIED)
    const { enabled, port } = deps.settings.get().mcp
    const address = `http://127.0.0.1:${port}/mcp`
    const token = deps.secrets.get('mcp.token') ?? null
    const claudeCode = token
      ? `claude mcp add --transport http adman ${address} --header "Authorization: Bearer ${token}"`
      : null
    const running = mcp.running()
    return { enabled, running, problem: mcp.problem(), address, port, token, claudeCode }
  }
}

export function mcpQueries(deps: Deps, mcp: McpState): Record<string, QueryFn> {
  return { 'mcp.getConnectInfo': mcpGetConnectInfo(deps, mcp) }
}
