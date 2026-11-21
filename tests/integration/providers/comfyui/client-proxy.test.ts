// CU-2b (b), security class: a child process that starts with NODE_USE_ENV_PROXY=1 and the
// proxy variables pointing at a proxy stand-in. Node's own agent then goes through the proxy
// (the control), and the ComfyUI client still goes straight to the pinned stand-in: the
// proxy stand-in sees no connection at all.
import { afterEach, describe, expect, it } from 'vitest'
import { startComfyStandIn, type StandIn } from '../../../helpers/comfy-stand-in'
import { runChild, startProxyStandIn, type ProxyStandIn } from '../../../helpers/comfy-child'
import { hasOpenssl, startTlsStandIn, type TlsStandIn } from '../../../helpers/comfy-tls-stand-in'

const openssl = hasOpenssl()
if (!openssl) process.stdout.write('CU-2b https proxy proof skipped: openssl is not installed\n')

const started: Array<StandIn | ProxyStandIn | TlsStandIn> = []
function track<T extends StandIn | ProxyStandIn | TlsStandIn>(standIn: T): T {
  started.push(standIn)
  return standIn
}

afterEach(async () => {
  await Promise.all(started.splice(0).map((s) => s.close()))
})

function proxyEnv(proxy: string): Record<string, string> {
  return {
    NODE_USE_ENV_PROXY: '1',
    HTTP_PROXY: proxy,
    HTTPS_PROXY: proxy,
    ALL_PROXY: proxy,
    http_proxy: proxy,
    https_proxy: proxy,
    NO_PROXY: '',
    no_proxy: '',
  }
}

type Outcome = { name: string; ok: boolean; reason?: string }

describe('NODE_USE_ENV_PROXY=1 in a real process [CU-2b, SPEC 6.10.2]', () => {
  it('control: Node’s global agent in that process goes through the proxy', async () => {
    const pinned = track(await startComfyStandIn())
    const proxy = track(await startProxyStandIn())
    const status = await runChild('global', `${pinned.origin}/system_stats`, proxyEnv(proxy.origin))
    expect(status).toBe(502)
    expect(proxy.connections()).toBe(1)
    expect(pinned.seen).toHaveLength(0)
  })

  it('every client call reaches the pinned stand-in; the proxy sees no connection', async () => {
    const pinned = track(await startComfyStandIn())
    const proxy = track(await startProxyStandIn())
    const outcomes = (await runChild('client', pinned.origin, proxyEnv(proxy.origin))) as Outcome[]
    expect(outcomes).toHaveLength(11)
    expect(outcomes.filter((o) => !o.ok)).toEqual([])
    expect(pinned.seen).toHaveLength(11)
    expect(proxy.connections()).toBe(0)
  })
})

describe.skipIf(!openssl)('NODE_USE_ENV_PROXY=1 with https and checks turned off [CU-2b]', () => {
  const env = (proxy: string) => ({ ...proxyEnv(proxy), NODE_TLS_REJECT_UNAUTHORIZED: '0' })

  it('control: Node’s global agent sends an https request through the proxy', async () => {
    const pinned = track(await startTlsStandIn())
    const proxy = track(await startProxyStandIn())
    await runChild('global', `${pinned.origin}/system_stats`, env(proxy.origin))
    expect(proxy.connections()).toBe(1)
    expect(pinned.connections()).toBe(0)
  })

  it('the client connects straight to the pinned server and refuses it: certificate', async () => {
    const pinned = track(await startTlsStandIn())
    const proxy = track(await startProxyStandIn())
    const outcomes = (await runChild('client', pinned.origin, env(proxy.origin))) as Outcome[]
    expect(outcomes).toHaveLength(11)
    expect(outcomes.every((o) => !o.ok && o.reason === 'certificate')).toBe(true)
    expect(pinned.connections()).toBe(11)
    expect(pinned.requests()).toBe(0)
    expect(proxy.connections()).toBe(0)
  })
})
