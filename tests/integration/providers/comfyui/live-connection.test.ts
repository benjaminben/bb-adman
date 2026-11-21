// CU-9 [REQ: FR-269] (security class): the live connection against stand-ins on 127.0.0.1.
// It listens only, connects only to the client's own origin through the client's own agent,
// and ends in silence on any failure.
import http from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createComfyClient } from '@/main/providers/comfyui/client'
import { LiveLink } from '@/main/providers/comfyui/live'
import type { LiveSeen } from '@/main/providers/comfyui/live-messages'
import {
  binaryFrame,
  startLiveStandIn,
  textFrame,
  type LiveStandIn,
} from '../../../helpers/comfy-live-stand-in'
import { hasOpenssl } from '../../../helpers/comfy-tls-stand-in'

const own = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b'
const other = '00000000-4d5e-4f60-8a7b-9c0d1e2f3a4b'
const progress = (value: number, id = own) => ({
  type: 'progress',
  data: { value, max: 10, prompt_id: id },
})

const started: LiveStandIn[] = []
async function standIn(...args: Parameters<typeof startLiveStandIn>): Promise<LiveStandIn> {
  const s = await startLiveStandIn(...args)
  started.push(s)
  return s
}

afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  await Promise.all(started.splice(0).map((s) => s.close()))
})

type Seen = Exclude<LiveSeen, 'ended'>

function watching(origin: string, ownPorts: number[] = []) {
  const live = new LiveLink()
  const client = createComfyClient({ origin, ownPorts: () => ownPorts, live })
  const seen: Seen[] = []
  const stop = live.watch(own, (s) => seen.push(s))
  return { client, seen, stop }
}

const until = (test: () => boolean) => vi.waitFor(() => expect(test()).toBe(true), 3000)
const settle = () => new Promise((done) => setTimeout(done, 150))

describe('live connection [CU-9, spec/comfyui.md "Live progress"]', () => {
  it('passes on the own run’s progress and drops binary, other runs and bad text', async () => {
    const s = await standIn()
    const { seen, stop } = watching(s.origin)
    await until(() => s.open() === 1)
    s.send(
      binaryFrame(4096),
      textFrame(progress(5, other)),
      textFrame('{not json'),
      textFrame({ type: 'status', data: { sid: 'x' } }),
      textFrame(progress(3)),
      textFrame({ type: 'executing', data: { node: '4', prompt_id: own } }),
    )
    await until(() => seen.length === 2)
    expect(seen).toEqual([{ stage: 'working', fraction: 0.3 }, { stage: 'working' }])
    expect(s.open()).toBe(1)
    stop()
    await until(() => s.open() === 0)
  })

  it('the handshake names the client’s own ID and carries no Origin, Cookie or Authorization', async () => {
    const s = await standIn()
    const { client } = watching(s.origin)
    await until(() => s.upgrades.length === 1)
    await client.submit(own, {}).catch(() => undefined)
    const sent = JSON.parse(s.posted[0] ?? '{}') as { client_id?: string }
    const { path, headers } = s.upgrades[0]!
    expect(path).toBe(`/ws?clientId=${sent.client_id}`)
    expect(Object.keys(headers).sort()).toEqual([
      'connection',
      'host',
      'sec-websocket-key',
      'sec-websocket-version',
      'upgrade',
      'user-agent',
    ])
    expect(headers['user-agent']).toBe('Adman')
  })

  it.each<[string, (s: LiveStandIn, stop: () => void) => void]>([
    [
      'the run’s end message',
      (s) => s.send(textFrame({ type: 'execution_success', data: { prompt_id: own } })),
    ],
    ['a text message over 64 KiB', (s) => s.send(textFrame('x'.repeat(65_537)))],
    ['a binary message over 64 KiB', (s) => s.send(binaryFrame(65_537))],
    ['the run stopping it', (_s, stop) => stop()],
    ['the server closing it', (s) => void s.close()],
  ])('closes on %s, in silence, and hears nothing after', async (_name, end) => {
    const s = await standIn()
    const { seen, stop } = watching(s.origin)
    await until(() => s.open() === 1)
    end(s, stop)
    await until(() => s.open() === 0)
    s.send(textFrame(progress(9)))
    await settle()
    expect(seen).toEqual([])
    expect(() => stop()).not.toThrow()
  })

  it('stopped before the handshake ends, it leaves no connection open', async () => {
    const s = await standIn()
    const { seen, stop } = watching(s.origin)
    stop()
    await settle()
    s.send(textFrame(progress(9)))
    await until(() => s.open() === 0)
    expect(seen).toEqual([])
  })

  it('does not follow a redirect', async () => {
    const elsewhere = await standIn()
    const s = await standIn({ redirectTo: `ws://127.0.0.1:${elsewhere.port}/ws` })
    const { seen } = watching(s.origin)
    await until(() => s.upgrades.length === 1)
    await settle()
    expect(elsewhere.connections()).toBe(0)
    expect(seen).toEqual([])
  })

  it.each([
    ['127.0.0.1', (port: number) => `http://127.0.0.1:${port}`],
    ['localhost', (port: number) => `http://localhost:${port}`],
  ])('opens nothing for a refused host: %s on an own port', async (_name, origin) => {
    const s = await standIn()
    const { seen } = watching(origin(s.port), [s.port])
    await settle()
    expect(s.connections()).toBe(0)
    expect(seen).toEqual([])
  })

  it('uses the client’s own agent and the checked lookup', async () => {
    const s = await standIn()
    const spy = vi.spyOn(http, 'request')
    const { client } = watching(s.origin)
    await until(() => s.upgrades.length === 1)
    await client.systemStats().catch(() => undefined)
    const sent = spy.mock.calls.map(([options]) => options as http.RequestOptions)
    expect(sent).toHaveLength(2)
    const [live, call] = sent as [http.RequestOptions, http.RequestOptions]
    expect(live.agent).toBe(call.agent)
    expect(live.agent).not.toBe(http.globalAgent)
    expect(typeof live.lookup).toBe('function')
    expect('origin' in live).toBe(false)
  })
})

describe.skipIf(!hasOpenssl())('live connection over wss [CU-9]', () => {
  it('refuses a self-signed certificate with NODE_TLS_REJECT_UNAUTHORIZED=0', async () => {
    vi.stubEnv('NODE_TLS_REJECT_UNAUTHORIZED', '0')
    const s = await standIn({ secure: true })
    const { seen } = watching(s.origin)
    await until(() => s.connections() === 1)
    await settle()
    expect(s.upgrades).toHaveLength(0)
    expect(seen).toEqual([])
  })
})
