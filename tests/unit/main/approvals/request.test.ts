// How send builds an https request (spec/approvals.md "The service client"; AP-6 security
// review): certificate checks on for the agent and the request, no proxy, the checked lookup,
// and the saved host as host name and TLS server name. https.request is a spy, so nothing is
// sent anywhere.
import http from 'node:http'
import https from 'node:https'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { send, type Target } from '@/main/approvals/request'
import { APPROVALS_REASON_MESSAGES } from '@/shared/approvals/messages'

const target = (over: Partial<Target> = {}): Target => ({
  origin: 'https://approvals.example.com:8443',
  key: 'made-up-approvals-key-for-the-request-test-01',
  allowLocalHttp: false,
  totalMs: 1000,
  maxBytes: 1024,
  resolve: async () => [{ address: '93.184.216.34', family: 4 }],
  ...over,
})

type Seen = https.RequestOptions & { agent: https.Agent & { options: Record<string, unknown> } }

function spyRequests() {
  const seen: Seen[] = []
  const secure = vi.spyOn(https, 'request').mockImplementation(((options: Seen) => {
    seen.push(options)
    throw new Error('stopped by the test')
  }) as unknown as typeof https.request)
  const plain = vi.spyOn(http, 'request')
  return { seen, secure, plain }
}

afterEach(() => vi.restoreAllMocks())

describe('send over https [spec/approvals.md "The service client"]', () => {
  it('turns certificate checks on, sets no proxy, and passes the checked lookup', async () => {
    const { seen, plain } = spyRequests()
    await send(target(), { method: 'GET', path: '/api/v1/health' }).catch(() => undefined)
    expect(seen).toHaveLength(1)
    expect(plain).not.toHaveBeenCalled()
    const options = seen[0] as Seen
    expect(options.rejectUnauthorized).toBe(true)
    expect(options.agent).toBeInstanceOf(https.Agent)
    expect(options.agent).not.toBe(https.globalAgent)
    expect(options.agent.options.rejectUnauthorized).toBe(true)
    expect(options.agent.options.keepAlive).toBe(false)
    for (const name of ['proxy', 'proxyEnv']) {
      expect(options.agent.options).not.toHaveProperty(name)
      expect(options).not.toHaveProperty(name)
    }
    expect(typeof options.lookup).toBe('function')
    expect(options.hostname).toBe('approvals.example.com')
    expect(options.servername).toBe('approvals.example.com')
    expect(options.port).toBe(8443)
    expect(options.protocol).toBe('https:')
    expect(options.headers).not.toHaveProperty('Origin')
  })

  it.each([
    ['a space', 'made-up key'],
    ['a line break', 'made-up-key\r\nX-Other: 1'],
    ['a letter outside ASCII', 'made-up-kéy'],
    ['nothing', ''],
  ])('refuses a key with %s as not set up, and builds no request', async (_n, key) => {
    const { secure, plain } = spyRequests()
    await expect(send(target({ key }), { method: 'GET', path: '/api/v1/health' })).rejects.toEqual(
      expect.objectContaining({
        code: 'RULE_VIOLATION',
        message: APPROVALS_REASON_MESSAGES.approvals_not_set_up,
        details: { reason: 'approvals_not_set_up' },
      }),
    )
    expect(secure).not.toHaveBeenCalled()
    expect(plain).not.toHaveBeenCalled()
  })
})
