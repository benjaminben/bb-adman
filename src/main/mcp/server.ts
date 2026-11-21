// The MCP server's listener (SPEC 6.8, 5.1, 5.3): Streamable HTTP on 127.0.0.1 only.
// Every request passes the request guard before any session or command sees it.
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { checkRequest } from './request-guard'
import { createSessions, type SessionOptions, type Sessions } from './sessions'

export const MCP_HOST = '127.0.0.1'
export const MCP_PATH = '/mcp'

export class McpPortInUse extends Error {
  constructor(readonly port: number) {
    super(`Port ${port} is in use.`)
  }
}

export type McpHttp = ReturnType<typeof createMcpHttp>

type Running = { server: http.Server; sessions: Sessions }
type Door = { port: number; token: string }

function refuse(res: http.ServerResponse, status: number, message: string): void {
  const auth = status === 401 ? { 'www-authenticate': 'Bearer' } : {}
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', ...auth })
  res.end(message)
}

async function route(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  door: Door,
  sessions: Sessions,
): Promise<void> {
  const refusal = checkRequest(req.headers, door)
  if (refusal) return refuse(res, refusal.status, refusal.message)
  if (new URL(req.url ?? '/', 'http://local').pathname !== MCP_PATH) {
    return refuse(res, 404, 'Not found.')
  }
  try {
    await sessions.handle(req, res)
  } catch {
    if (!res.headersSent) refuse(res, 500, 'The request could not be handled.')
    else res.end()
  }
}

function listen(server: http.Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', (e: NodeJS.ErrnoException) =>
      reject(e.code === 'EADDRINUSE' ? new McpPortInUse(port) : e),
    )
    server.listen({ port, host: MCP_HOST }, resolve)
  })
}

export function createMcpHttp(opts: SessionOptions) {
  let running: Running | null = null

  async function stop(): Promise<void> {
    const was = running
    running = null
    if (!was) return
    // The connections and the listener close even if closing a session fails, so the old
    // token never stays bound (REVIEW MCP-A Fixes S-1). The failure is still passed on.
    try {
      await was.sessions.closeAll()
    } finally {
      was.server.closeAllConnections()
      await new Promise<void>((resolve) => was.server.close(() => resolve()))
    }
  }

  return {
    // Starting again first stops, so a new token drops every open session (SPEC 5.1).
    async start(door: Door): Promise<void> {
      await stop()
      const sessions = createSessions(opts)
      const server = http.createServer((req, res) => void route(req, res, door, sessions))
      await listen(server, door.port)
      running = { server, sessions }
    },
    stop,
    running: (): boolean => running !== null,
    address: (): AddressInfo | null => (running?.server.address() as AddressInfo) ?? null,
  }
}
