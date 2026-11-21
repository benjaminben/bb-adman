// CU-9: a stand-in for ComfyUI's live connection on 127.0.0.1, with the WebSocket handshake and
// frames written by hand, so nothing of the client under test is reused. It records every
// handshake it sees and every TCP connection, and can answer with a redirect instead.
import crypto from 'node:crypto'
import http from 'node:http'
import https from 'node:https'
import type { AddressInfo, Socket } from 'node:net'
import { certificateOnce } from './comfy-tls-stand-in'

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

export type LiveFrame = { opcode: 1 | 2; payload: Buffer }

export const textFrame = (value: unknown): LiveFrame => ({
  opcode: 1,
  payload: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)),
})
export const binaryFrame = (size: number): LiveFrame => ({
  opcode: 2,
  payload: Buffer.alloc(size, 7),
})

function encode({ opcode, payload }: LiveFrame): Buffer {
  const length = payload.byteLength
  let head: Buffer
  if (length < 126) head = Buffer.from([0x80 | opcode, length])
  else if (length < 65536) {
    head = Buffer.from([0x80 | opcode, 126, 0, 0])
    head.writeUInt16BE(length, 2)
  } else {
    head = Buffer.alloc(10)
    head[0] = 0x80 | opcode
    head[1] = 127
    head.writeBigUInt64BE(BigInt(length), 2)
  }
  return Buffer.concat([head, payload])
}

export type LiveStandIn = {
  origin: string
  port: number
  // Each handshake request: its path and headers.
  upgrades: Array<{ path: string; headers: http.IncomingHttpHeaders }>
  // The body of each plain request (no upgrade), as text; and TCP connections.
  posted: string[]
  connections: () => number
  // How many accepted live sockets are open now.
  open: () => number
  // Sends frames on every open live socket.
  send(...frames: LiveFrame[]): void
  close(): Promise<void>
}

// `greet`: frames sent on each live socket right after the handshake.
export type LiveOptions = { secure?: boolean; redirectTo?: string; greet?: LiveFrame[] }

export async function startLiveStandIn(options: LiveOptions = {}): Promise<LiveStandIn> {
  const upgrades: LiveStandIn['upgrades'] = []
  const sockets = new Set<Socket>()
  const posted: string[] = []
  let connections = 0
  const onRequest = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      posted.push(Buffer.concat(chunks).toString('utf8'))
      res.writeHead(404)
      res.end()
    })
  }
  const server = options.secure
    ? https.createServer(certificateOnce(), onRequest)
    : http.createServer(onRequest)
  server.on('connection', () => (connections += 1))
  server.on('upgrade', (req: http.IncomingMessage, socket: Socket) => {
    upgrades.push({ path: req.url ?? '', headers: req.headers })
    socket.on('error', () => undefined)
    if (options.redirectTo) {
      socket.end(
        `HTTP/1.1 302 Found\r\nLocation: ${options.redirectTo}\r\nContent-Length: 0\r\n\r\n`,
      )
      return
    }
    const key = String(req.headers['sec-websocket-key'])
    const accept = crypto
      .createHash('sha1')
      .update(key + GUID)
      .digest('base64')
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    )
    sockets.add(socket)
    // What the client sends is read and dropped, so its end is seen and the socket closes.
    socket.on('end', () => socket.destroy())
    socket.on('close', () => sockets.delete(socket))
    socket.resume()
    for (const frame of options.greet ?? []) socket.write(encode(frame))
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const { port } = server.address() as AddressInfo
  return {
    origin: `${options.secure ? 'https' : 'http'}://127.0.0.1:${port}`,
    port,
    upgrades,
    posted,
    connections: () => connections,
    open: () => sockets.size,
    send: (...frames) => {
      for (const socket of sockets) for (const frame of frames) socket.write(encode(frame))
    },
    close: () =>
      new Promise<void>((done) => {
        for (const socket of sockets) socket.destroy()
        server.closeAllConnections()
        server.close(() => done())
      }),
  }
}
