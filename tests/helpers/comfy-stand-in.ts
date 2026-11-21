// SPEC 6.10.11: a small HTTP server on 127.0.0.1 with a free port that plays the routes of
// 6.10.2. A test can tell any route to answer otherwise: wait, fail, redirect, send too much
// or vanish. It records every request it sees. Nothing here contacts a real server.
import http from 'node:http'
import type { AddressInfo, Socket } from 'node:net'

export type Reply =
  | {
      status?: number
      json?: unknown
      body?: Uint8Array | string
      headers?: Record<string, string>
      // Send content-length (the default). false sends the body in chunks with no length.
      length?: boolean
    }
  | { wait: true } // takes the request and never answers
  | { vanish: true } // drops the connection without an answer
  | { stall: true } // sends the status line, headers and one chunk, then nothing more

export type Seen = {
  method: string
  path: string
  headers: http.IncomingHttpHeaders
  body: Buffer
}

export type StandIn = {
  origin: string
  port: number
  seen: Seen[]
  // `route` is "METHOD /path", the path without its query, or "*" for every route not
  // named on its own.
  reply(route: string, reply: Reply): void
  // CU-9: hands every upgrade request (the live connection) to this function from now on.
  // Until it is called, the server has no upgrade listener, as before.
  upgrade(handler: (req: http.IncomingMessage, socket: Socket) => void): void
  close(): Promise<void>
}

const PICTURE = Buffer.from('stand-in picture bytes')

function playRoute(method: string, path: string, body: Buffer): Reply {
  const [pathname = ''] = path.split('?')
  const tail = decodeURIComponent(pathname.split('/').pop() ?? '')
  if (method === 'GET' && pathname === '/system_stats') {
    return { json: { system: { comfyui_version: '0.3.40' }, devices: [{ name: 'stand-in' }] } }
  }
  if (method === 'GET' && pathname.startsWith('/models/')) {
    return { json: ['stand-in.safetensors'] }
  }
  if (method === 'GET' && pathname.startsWith('/object_info/')) {
    return { json: { [tail]: { input: {} } } }
  }
  if (method === 'POST' && pathname === '/upload/image') {
    const name = /filename="([^"]+)"/.exec(body.toString('latin1'))?.[1] ?? 'unnamed.png'
    return { json: { name, subfolder: 'adman', type: 'input' } }
  }
  if (method === 'POST' && pathname === '/prompt') {
    const sent = JSON.parse(body.toString('utf8')) as { prompt_id: string }
    return { json: { prompt_id: sent.prompt_id, number: 1, node_errors: {} } }
  }
  if (method === 'GET' && pathname.startsWith('/history/')) return { json: {} }
  if (method === 'GET' && pathname.startsWith('/api/jobs/')) return { json: { status: 'pending' } }
  if (method === 'GET' && pathname === '/queue') {
    return { json: { queue_running: [], queue_pending: [] } }
  }
  if (method === 'POST' && (pathname === '/queue' || pathname === '/interrupt')) return { json: {} }
  if (method === 'GET' && pathname === '/view') {
    return { body: PICTURE, headers: { 'content-type': 'image/png' } }
  }
  return { status: 404, json: { error: 'not found' } }
}

function answer(res: http.ServerResponse, socket: Socket, reply: Reply): void {
  if ('wait' in reply) return
  if ('vanish' in reply) {
    socket.destroy()
    return
  }
  if ('stall' in reply) {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.write('{')
    return
  }
  const body = reply.json !== undefined ? JSON.stringify(reply.json) : (reply.body ?? '')
  const bytes = typeof body === 'string' ? Buffer.from(body) : Buffer.from(body)
  const headers: Record<string, string> = {
    'content-type': reply.json !== undefined ? 'application/json' : 'application/octet-stream',
    ...reply.headers,
  }
  if (reply.length !== false) headers['content-length'] = String(bytes.byteLength)
  res.writeHead(reply.status ?? 200, headers)
  if (reply.length === false) {
    // Several chunks, so a reader that counts has to count across them.
    const step = Math.max(1, Math.ceil(bytes.byteLength / 4))
    for (let at = 0; at < bytes.byteLength; at += step) res.write(bytes.subarray(at, at + step))
    res.end()
  } else {
    res.end(bytes)
  }
}

export async function startComfyStandIn(): Promise<StandIn> {
  const seen: Seen[] = []
  const replies = new Map<string, Reply>()
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      const method = req.method ?? ''
      const path = req.url ?? ''
      const body = Buffer.concat(chunks)
      seen.push({ method, path, headers: req.headers, body })
      const route = `${method} ${path.split('?')[0] ?? ''}`
      answer(
        res,
        req.socket,
        replies.get(route) ?? replies.get('*') ?? playRoute(method, path, body),
      )
    })
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const { port } = server.address() as AddressInfo
  return {
    origin: `http://127.0.0.1:${port}`,
    port,
    seen,
    reply: (route, reply) => replies.set(route, reply),
    upgrade: (handler) => server.on('upgrade', handler),
    close: () =>
      new Promise<void>((done) => {
        server.closeAllConnections()
        server.close(() => done())
      }),
  }
}
