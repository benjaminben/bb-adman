// CU-2b (security class): an HTTPS stand-in on 127.0.0.1 with a self-signed certificate made
// at test time by openssl into a temporary folder. The key never enters the repository; the
// folder is gone before the server starts. It counts connections and requests.
import fs from 'node:fs'
import https from 'node:https'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import type { AddressInfo } from 'node:net'

export type TlsStandIn = {
  origin: string
  // Where the key and certificate were made; already removed.
  folder: string
  // TCP connections accepted, and HTTP requests read.
  connections: () => number
  requests: () => number
  close: () => Promise<void>
}

export function hasOpenssl(): boolean {
  const out = spawnSync('openssl', ['version'], { encoding: 'utf8' })
  return !out.error && out.status === 0
}

function makeCertificate(dir: string): { key: Buffer; cert: Buffer } {
  const key = path.join(dir, 'key.pem')
  const cert = path.join(dir, 'cert.pem')
  const out = spawnSync(
    'openssl',
    ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1'].concat(
      ['-subj', '/CN=adman-stand-in', '-keyout', key, '-out', cert],
    ),
    { encoding: 'utf8' },
  )
  if (out.error || out.status !== 0) throw new Error(`openssl failed: ${out.stderr}`)
  return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) }
}

// The folder is removed as soon as the key and certificate are read into memory.
function certificateOnce(): { key: Buffer; cert: Buffer; dir: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-tls-'))
  try {
    return { ...makeCertificate(dir), dir }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

export async function startTlsStandIn(): Promise<TlsStandIn> {
  const { key, cert, dir } = certificateOnce()
  let connections = 0
  let requests = 0
  const server = https.createServer({ key, cert }, (_req, res) => {
    requests += 1
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ system: { comfyui_version: '0.3.40' }, devices: [] }))
  })
  server.on('connection', () => (connections += 1))
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const { port } = server.address() as AddressInfo
  return {
    origin: `https://127.0.0.1:${port}`,
    folder: dir,
    connections: () => connections,
    requests: () => requests,
    close: () =>
      new Promise<void>((done) => {
        server.closeAllConnections()
        server.close(() => done())
      }),
  }
}
