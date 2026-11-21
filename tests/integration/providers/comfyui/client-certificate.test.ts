// CU-2b (a), security class: a real TLS server with a self-signed certificate, made at test
// time. With NODE_TLS_REJECT_UNAUTHORIZED=0 set, a plain Node request accepts it (the
// control), and the ComfyUI client still refuses it with reason `certificate`.
import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import https from 'node:https'
import { createComfyClient } from '@/main/providers/comfyui/client'
import { everyCall } from '../../../helpers/comfy-every-call'
import { failureOf } from '../../../helpers/failure-of'
import { hasOpenssl, startTlsStandIn, type TlsStandIn } from '../../../helpers/comfy-tls-stand-in'

const openssl = hasOpenssl()
if (!openssl) console.warn('CU-2b certificate proof skipped: openssl is not installed')

const started: TlsStandIn[] = []
async function tlsStandIn(): Promise<TlsStandIn> {
  const standIn = await startTlsStandIn()
  started.push(standIn)
  return standIn
}

afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(started.splice(0).map((s) => s.close()))
})

// A request with Node's global agent and no certificate option: what any other code gets.
function plainGet(origin: string): Promise<number | string> {
  return new Promise((done) => {
    https
      .get(`${origin}/system_stats`, (res) => {
        res.resume()
        done(res.statusCode ?? 0)
      })
      .on('error', (error: NodeJS.ErrnoException) => done(error.code ?? 'error'))
  })
}

describe.skipIf(!openssl)('a self-signed certificate on a real server [CU-2b, SPEC 6.10.2]', () => {
  it('the key and certificate folder is gone once the server runs', async () => {
    const standIn = await tlsStandIn()
    expect(fs.existsSync(standIn.folder)).toBe(false)
  })

  it('control: with NODE_TLS_REJECT_UNAUTHORIZED=0, a plain Node request accepts it', async () => {
    const standIn = await tlsStandIn()
    expect(await plainGet(standIn.origin)).toBe('DEPTH_ZERO_SELF_SIGNED_CERT')
    vi.stubEnv('NODE_TLS_REJECT_UNAUTHORIZED', '0')
    expect(await plainGet(standIn.origin)).toBe(200)
    expect(standIn.requests()).toBe(1)
  })

  it('with NODE_TLS_REJECT_UNAUTHORIZED=0, every client call is refused: certificate', async () => {
    vi.stubEnv('NODE_TLS_REJECT_UNAUTHORIZED', '0')
    const standIn = await tlsStandIn()
    const client = createComfyClient({ origin: standIn.origin, ownPorts: () => [] })
    const calls = everyCall(client)
    for (const [, run] of calls) {
      expect(await failureOf(run())).toMatchObject({ kind: 'other', reason: 'certificate' })
    }
    // The client did connect to this server, and sent it nothing.
    expect(standIn.connections()).toBe(calls.length)
    expect(standIn.requests()).toBe(0)
  })
})
