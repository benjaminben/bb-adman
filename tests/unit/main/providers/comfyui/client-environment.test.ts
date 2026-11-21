import { afterEach, describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import http from 'node:http'
import https from 'node:https'
import { createComfyClient } from '../../../../../src/main/providers/comfyui/client'
import { everyCall } from '../../../../helpers/comfy-every-call'
import { startComfyStandIn, type StandIn } from '../../../../helpers/comfy-stand-in'
import { failureOf } from '../../../../helpers/failure-of'

const standIns: StandIn[] = []
async function standIn(): Promise<StandIn> {
  const started = await startComfyStandIn()
  standIns.push(started)
  return started
}

afterEach(async () => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  await Promise.all(standIns.splice(0).map((s) => s.close()))
})

type SentOptions = http.RequestOptions & { rejectUnauthorized?: boolean }
type AgentWithOptions = http.Agent & { options: Record<string, unknown> }

function stubHostileEnvironment(proxy: string): void {
  for (const name of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy']) {
    vi.stubEnv(name, proxy)
  }
  vi.stubEnv('NO_PROXY', 'made-up-host.invalid')
  vi.stubEnv('no_proxy', 'made-up-host.invalid')
  vi.stubEnv('NODE_TLS_REJECT_UNAUTHORIZED', '0')
}

// A stand-in https.request that sends nothing: it records what is written and fails with
// the given error code, as Node does when a connection or a certificate check fails.
function fakeHttps(code: string) {
  const written: unknown[] = []
  const spy = vi.spyOn(https, 'request').mockImplementation((() => {
    const req = Object.assign(new EventEmitter(), {
      write: (chunk: unknown) => written.push(chunk),
      end: (chunk?: unknown) => written.push(chunk ?? 'end'),
      destroy: () => undefined,
    })
    process.nextTick(() => req.emit('error', Object.assign(new Error('stand-in'), { code })))
    return req
  }) as unknown as typeof https.request)
  return { spy, written }
}

describe('nothing from the environment [SPEC 6.10.2, 14 1.41 ruling 2, CU-2]', () => {
  it('goes straight to the pinned origin with hostile proxy and TLS variables set', async () => {
    const pinned = await standIn()
    const decoy = await standIn()
    stubHostileEnvironment(decoy.origin)
    const client = createComfyClient({ origin: pinned.origin, ownPorts: () => [9100] })
    expect(await client.systemStats()).toMatchObject({ comfyuiVersion: '0.3.40' })
    expect(pinned.seen.map((s) => s.path)).toEqual(['/system_stats'])
    expect(decoy.seen).toHaveLength(0)
  })

  it('uses its own Agent on every request: not a global one, made with no proxyEnv', async () => {
    const pinned = await standIn()
    const client = createComfyClient({ origin: pinned.origin, ownPorts: () => [9100] })
    const spy = vi.spyOn(http, 'request')
    const calls = everyCall(client)
    for (const [, run] of calls) await run()
    const agents = spy.mock.calls.map(([options]) => (options as SentOptions).agent)
    expect(agents).toHaveLength(calls.length)
    const own = agents[0] as AgentWithOptions
    expect(own).toBeInstanceOf(http.Agent)
    expect(agents.every((a) => a === own)).toBe(true)
    expect(own).not.toBe(http.globalAgent)
    expect(own).not.toBe(https.globalAgent)
    expect('proxyEnv' in own.options).toBe(false)
  })

  it('the call list covers every network function of the client', () => {
    const client = createComfyClient({ origin: 'http://127.0.0.1:8188', ownPorts: () => [] })
    const names = everyCall(client).map(([name]) => name)
    expect(names.sort()).toEqual(
      Object.keys(client)
        .filter((k) => k !== 'adopt')
        .sort(),
    )
  })
})

describe('certificate checks stay on [SPEC 6.10.1, 14 1.41 ruling 1, CU-2]', () => {
  const origin = 'https://comfy.example.lan'

  it('passes rejectUnauthorized: true and its own Agent on every https call', async () => {
    vi.stubEnv('NODE_TLS_REJECT_UNAUTHORIZED', '0')
    const { spy } = fakeHttps('ECONNREFUSED')
    const client = createComfyClient({ origin, ownPorts: () => [9100] })
    const calls = everyCall(client)
    for (const [, run] of calls) await run().catch(() => undefined)
    expect(spy).toHaveBeenCalledTimes(calls.length)
    const sent = spy.mock.calls.map(([options]) => options as SentOptions)
    const own = sent[0]?.agent as AgentWithOptions
    expect(own).toBeInstanceOf(https.Agent)
    expect(own).not.toBe(https.globalAgent)
    expect(own.options.rejectUnauthorized).toBe(true)
    expect('proxyEnv' in own.options).toBe(false)
    for (const options of sent) {
      expect(options.rejectUnauthorized).toBe(true)
      expect(options.agent).toBe(own)
    }
  })

  it.each([
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'SELF_SIGNED_CERT_IN_CHAIN',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'CERT_HAS_EXPIRED',
    'ERR_TLS_CERT_ALTNAME_INVALID',
  ])('%s gives reason certificate, with nothing written', async (code) => {
    const { written } = fakeHttps(code)
    const client = createComfyClient({ origin, ownPorts: () => [9100] })
    for (const [, run] of everyCall(client)) {
      expect(await failureOf(run())).toMatchObject({ kind: 'other', reason: 'certificate' })
    }
    expect(written).toEqual([])
  })
})
