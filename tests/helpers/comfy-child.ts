// CU-2b: starts plain Node on comfy-child-entry.ts with the given variables set from the
// first instruction, and returns the one JSON line it prints. Also a proxy stand-in that
// counts every connection made to it and answers none usefully.
import http from 'node:http'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import type { AddressInfo } from 'node:net'

const here = path.dirname(fileURLToPath(import.meta.url))
const entry = path.join(here, 'comfy-child-entry.ts')
const src = path.resolve(here, '../../src')

// Proxy and TLS names the child must not inherit from the shell that runs the tests.
const cleared = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY']
  .flatMap((n) => [n, n.toLowerCase()])
  .concat(['NODE_TLS_REJECT_UNAUTHORIZED', 'NODE_USE_ENV_PROXY', 'NODE_OPTIONS'])

export function runChild(
  mode: 'client' | 'global',
  target: string,
  env: Record<string, string>,
): Promise<unknown> {
  const base = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !cleared.includes(name)),
  )
  return new Promise((done, fail) => {
    execFile(
      process.execPath,
      [entry, src, mode, target],
      { env: { ...base, ...env }, timeout: 60_000 },
      (error, stdout, stderr) => {
        if (error) return fail(new Error(`child failed: ${stderr}`))
        done(JSON.parse(stdout.trim().split('\n').pop() ?? 'null'))
      },
    )
  })
}

export type ProxyStandIn = { origin: string; connections: () => number; close: () => Promise<void> }

export async function startProxyStandIn(): Promise<ProxyStandIn> {
  let connections = 0
  const server = http.createServer((_req, res) => {
    res.writeHead(502)
    res.end()
  })
  server.on('connection', () => (connections += 1))
  // A CONNECT tunnel request (for https) is refused.
  server.on('connect', (_req, socket) => socket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n'))
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const { port } = server.address() as AddressInfo
  return {
    origin: `http://127.0.0.1:${port}`,
    connections: () => connections,
    close: () =>
      new Promise<void>((done) => {
        server.closeAllConnections()
        server.close(() => done())
      }),
  }
}
