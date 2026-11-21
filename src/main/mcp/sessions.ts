// MCP sessions, held in memory only (SPEC 5.3). Each session has its own MCP SDK server
// and Streamable HTTP transport. Only requests that passed the request guard get here.
import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { AgentCaller } from './agent-caller'

// Adds tools to one session's server. MCP-A passes none (SPEC 14, 1.56); MCP-B fills it.
export type ToolSetup = (server: McpServer, caller: AgentCaller) => void

export type SessionOptions = { caller: AgentCaller; appVersion: string; tools?: ToolSetup }

export type Sessions = ReturnType<typeof createSessions>

function sessionNotFound(res: ServerResponse): void {
  const error = { code: -32001, message: 'Session not found' }
  res.writeHead(404, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ jsonrpc: '2.0', error, id: null }))
}

export function createSessions(opts: SessionOptions) {
  const open = new Map<string, StreamableHTTPServerTransport>()

  async function startSession(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => void open.set(id, transport),
    })
    transport.onclose = () => {
      if (transport.sessionId) open.delete(transport.sessionId)
    }
    const server = new McpServer({ name: 'adman', version: opts.appVersion })
    opts.tools?.(server, opts.caller)
    await server.connect(transport)
    await transport.handleRequest(req, res)
    // A first request that was not a valid initialize leaves no session behind.
    if (!transport.sessionId) await server.close()
  }

  return {
    async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
      const id = req.headers['mcp-session-id']
      if (id === undefined) return startSession(req, res)
      const transport = typeof id === 'string' ? open.get(id) : undefined
      if (!transport) return sessionNotFound(res)
      return transport.handleRequest(req, res)
    },
    async closeAll(): Promise<void> {
      const all = [...open.values()]
      open.clear()
      await Promise.all(all.map((t) => t.close()))
    },
  }
}
