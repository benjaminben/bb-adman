// CU-9 (security class): a child process that starts with NODE_USE_ENV_PROXY=1 and the proxy
// variables pointing at a proxy stand-in. Its live connection still goes straight to the
// pinned live stand-in, through the client's own agent: the proxy sees no connection.
import { afterEach, describe, expect, it } from 'vitest'
import { runChild, startProxyStandIn, type ProxyStandIn } from '../../../helpers/comfy-child'
import { startLiveStandIn, textFrame, type LiveStandIn } from '../../../helpers/comfy-live-stand-in'

const promptId = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b'
const started: Array<LiveStandIn | ProxyStandIn> = []

afterEach(async () => {
  await Promise.all(started.splice(0).map((s) => s.close()))
})

function proxyEnv(proxy: string): Record<string, string> {
  const names = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy']
  return {
    NODE_USE_ENV_PROXY: '1',
    ...Object.fromEntries(names.map((n) => [n, proxy])),
    NO_PROXY: '',
    no_proxy: '',
  }
}

describe('live connection with NODE_USE_ENV_PROXY=1 in a real process [CU-9]', () => {
  it('goes straight to the pinned server; the proxy sees no connection', async () => {
    const greet = [textFrame({ type: 'progress', data: { value: 1, max: 4, prompt_id: promptId } })]
    const pinned = await startLiveStandIn({ greet })
    const proxy = await startProxyStandIn()
    started.push(pinned, proxy)
    const heard = await runChild('live', pinned.origin, proxyEnv(proxy.origin))
    expect(heard).toEqual([{ stage: 'working', fraction: 0.25 }])
    expect(pinned.upgrades).toHaveLength(1)
    expect(proxy.connections()).toBe(0)
  })
})
