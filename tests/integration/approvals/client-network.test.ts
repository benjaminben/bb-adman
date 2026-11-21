// Where the approvals client connects (spec/approvals.md "The service client"; AP-5 security
// review note 2): no proxy from the environment, and an https name that resolves to a
// loopback, private or other non-public address is refused before anything is sent. The
// resolver is a stand-in, so no name is looked up on the network.
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createApprovalsClient } from '@/main/approvals/client'
import { isRefusedAddress, type Resolve } from '@/main/approvals/request'
import type { ActivityLog, LogInput } from '@/main/log/activity-log'
import { APPROVALS_FAILURE_MESSAGES } from '@/shared/approvals/messages'
import { startApprovalsStandIn, type ApprovalsStandIn } from '../../helpers/approvals-stand-in'

const KEY = 'made-up-approvals-key-for-the-network-test-07'

let stand: ApprovalsStandIn
let lines: LogInput[]
const log: ActivityLog = { write: (e) => lines.push(e), prune: () => {} }

beforeEach(async () => {
  stand = await startApprovalsStandIn({ key: KEY })
  lines = []
})
afterEach(async () => {
  await stand.close()
})

describe('isRefusedAddress', () => {
  it.each([
    ['127.0.0.1', true],
    ['127.255.0.9', true],
    ['10.1.2.3', true],
    ['172.16.0.1', true],
    ['172.31.255.255', true],
    ['192.168.1.20', true],
    ['169.254.169.254', true],
    ['100.64.0.1', true],
    ['0.0.0.0', true],
    ['224.0.0.1', true],
    ['255.255.255.255', true],
    ['::1', true],
    ['::', true],
    ['fd00::1', true],
    ['fe80::1', true],
    ['ff02::1', true],
    ['::ffff:127.0.0.1', true],
    ['::ffff:10.0.0.1', true],
    ['64:ff9b::7f00:1', true],
    ['not an address', true],
    ['172.32.0.1', false],
    ['93.184.216.34', false],
    ['2606:4700::6810:84e5', false],
    ['::ffff:93.184.216.34', false],
  ])('%s refused: %s', (address, refused) => {
    expect(isRefusedAddress(address)).toBe(refused)
  })
})

describe('the approvals client: the resolved address [AP-5 review note 2]', () => {
  const answers: Array<[string, Array<{ address: string; family: number }>]> = [
    ['loopback', [{ address: '127.0.0.1', family: 4 }]],
    ['a private address', [{ address: '192.168.1.20', family: 4 }]],
    ['IPv6 loopback', [{ address: '::1', family: 6 }]],
    [
      'one private among public ones',
      [
        { address: '93.184.216.34', family: 4 },
        { address: '10.0.0.5', family: 4 },
      ],
    ],
    ['no address', []],
  ]
  it.each(answers)(
    'refuses a name that resolves to %s, and connects to nothing',
    async (_n, list) => {
      const asked: string[] = []
      const resolve: Resolve = async (host) => {
        asked.push(host)
        return list
      }
      const origin = `https://approvals.made-up.example:${stand.port}`
      const client = createApprovalsClient(
        { origin, key: KEY },
        { allowLocalHttp: false, log, resolve },
      )
      await expect(client.health()).rejects.toMatchObject({
        code: 'PROVIDER_ERROR',
        message: APPROVALS_FAILURE_MESSAGES.offline,
        details: { service: 'approvals', kind: 'offline' },
      })
      expect(asked).toEqual(['approvals.made-up.example'])
      expect(stand.connections()).toBe(0)
      expect(JSON.stringify(lines)).not.toContain('made-up.example')
    },
  )

  it('a failed lookup is offline', async () => {
    const resolve: Resolve = async () => {
      throw Object.assign(new Error('getaddrinfo ENOTFOUND approvals.made-up.example'), {
        code: 'ENOTFOUND',
      })
    }
    const origin = 'https://approvals.made-up.example'
    const client = createApprovalsClient(
      { origin, key: KEY },
      { allowLocalHttp: false, log, resolve },
    )
    const error = await client.health().catch((e: unknown) => e)
    expect(error).toMatchObject({ details: { kind: 'offline' } })
    expect(String(error)).not.toContain('made-up.example')
  })

  it('still reaches the dev-tools test origin, which names 127.0.0.1 itself', async () => {
    const client = createApprovalsClient(
      { origin: stand.origin, key: KEY },
      { allowLocalHttp: true, log },
    )
    await expect(client.health()).resolves.toBeUndefined()
  })
})

describe('the approvals client: no proxy from the environment', () => {
  it('reaches the saved origin with proxy variables set, and the proxy sees nothing', async () => {
    let proxied = 0
    const proxy = http.createServer((_req, res) => {
      proxied += 1
      res.end()
    })
    proxy.on('connection', () => (proxied += 1))
    await new Promise<void>((r) => proxy.listen(0, '127.0.0.1', r))
    const proxyUrl = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`
    const names = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy']
    const saved = names.map((n) => process.env[n])
    try {
      for (const n of names) process.env[n] = proxyUrl
      const client = createApprovalsClient(
        { origin: stand.origin, key: KEY },
        { allowLocalHttp: true, log },
      )
      await client.health()
    } finally {
      names.forEach((n, i) =>
        saved[i] === undefined ? delete process.env[n] : (process.env[n] = saved[i]),
      )
      await new Promise<void>((r) => proxy.close(() => r()))
    }
    expect(stand.seen).toHaveLength(1)
    expect(proxied).toBe(0)
  })
})
