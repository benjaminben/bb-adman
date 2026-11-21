// Raw HTTP to the MCP server, so a test controls every header, Host and Origin included.
// Everything binds or connects to 127.0.0.1 only, apart from the refused-address checks.
import http from 'node:http'
import net from 'node:net'

export type Reply = { status: number; headers: http.IncomingHttpHeaders; body: string }

export const INIT = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'adman-test-client', version: '0.0.0' },
  },
}

export async function freePort(): Promise<number> {
  const probe = net.createServer()
  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve))
  const port = (probe.address() as net.AddressInfo).port
  await new Promise((resolve) => probe.close(resolve))
  return port
}

export function mcpHeaders(port: number, token: string, extra: Record<string, string> = {}) {
  return {
    host: `127.0.0.1:${port}`,
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    ...extra,
  }
}

export function send(opts: {
  port: number
  headers: Record<string, string | undefined>
  body?: unknown
  method?: string
  path?: string
  host?: string
}): Promise<Reply> {
  const headers = Object.fromEntries(
    Object.entries(opts.headers).filter((e): e is [string, string] => e[1] !== undefined),
  )
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: opts.host ?? '127.0.0.1',
        port: opts.port,
        method: opts.method ?? 'POST',
        path: opts.path ?? '/mcp',
        headers,
        setHost: false,
      },
      (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (c: string) => (body += c))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }))
      },
    )
    req.on('error', reject)
    if (opts.body !== undefined) req.write(JSON.stringify(opts.body))
    req.end()
  })
}

// A reply may be plain JSON or one server-sent event; this gives the JSON-RPC message.
export function message(reply: Reply): Record<string, unknown> {
  const text = reply.body.includes('data: ')
    ? (reply.body.split('\n').find((l) => l.startsWith('data: ')) ?? '').slice(6)
    : reply.body
  return JSON.parse(text) as Record<string, unknown>
}

// Opens a session and gives its ID.
export async function openSession(port: number, token: string): Promise<string> {
  const reply = await send({ port, headers: mcpHeaders(port, token), body: INIT })
  const id = reply.headers['mcp-session-id']
  if (reply.status !== 200 || typeof id !== 'string') throw new Error(`initialize: ${reply.status}`)
  const done = { jsonrpc: '2.0', method: 'notifications/initialized' }
  const extra = { 'mcp-session-id': id, 'mcp-protocol-version': INIT.params.protocolVersion }
  await send({ port, headers: mcpHeaders(port, token, extra), body: done })
  return id
}

export function sessionHeaders(port: number, token: string, id: string) {
  return mcpHeaders(port, token, {
    'mcp-session-id': id,
    'mcp-protocol-version': INIT.params.protocolVersion,
  })
}

// Resolves with the error code when nothing accepts a connection there.
export function connectError(host: string, port: number): Promise<string | null> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: 1000 })
    socket.once('connect', () => (socket.destroy(), resolve(null)))
    socket.once('timeout', () => (socket.destroy(), resolve('timeout')))
    socket.once('error', (e: NodeJS.ErrnoException) => resolve(e.code ?? 'error'))
  })
}
