// approvals.check (spec/approvals.md "approvals.check"): the saved address and key, then
// GET /api/v1/health. Every request goes to the stand-in on 127.0.0.1.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { approvalsCheck } from '@/main/commands/approvals/check'
import { makeFixture, type Fixture } from '../core-fixture'
import { APPROVALS_FAILURE_MESSAGES, APPROVALS_REASON_MESSAGES } from '@/shared/approvals/messages'
import { startApprovalsStandIn, type ApprovalsStandIn } from '../../helpers/approvals-stand-in'

const KEY = 'made-up-approvals-key-for-the-check-test-0099'
let f: Fixture
let stand: ApprovalsStandIn

beforeEach(async () => {
  stand = await startApprovalsStandIn({ key: KEY })
  f = makeFixture()
  Object.assign(f.core.deps, { devTools: true })
})
afterEach(async () => {
  f.cleanup()
  await stand.close()
})

async function setUp(opts: { address?: boolean; key?: string | null } = {}) {
  if (opts.address !== false) await f.user('approvals.setService', { address: stand.origin })
  const key = opts.key === undefined ? KEY : opts.key
  if (key !== null) await f.user('secret.set', { name: 'approvals.apiKey', value: key })
}

const check = () => f.user('approvals.check', {})
const NOT_SET_UP = {
  ok: false,
  error: {
    code: 'RULE_VIOLATION',
    message: APPROVALS_REASON_MESSAGES.approvals_not_set_up,
    details: { reason: 'approvals_not_set_up' },
  },
}

describe('approvals.check [spec/approvals.md "approvals.check"]', () => {
  it('answers ok when the service is connected', async () => {
    await setUp()
    expect(await check()).toEqual({ ok: true, data: { ok: true } })
    expect(stand.seen.map((s) => [s.method, s.path])).toEqual([['GET', '/api/v1/health']])
  })

  it.each([
    ['no address', { address: false }],
    ['no key', { key: null }],
    ['neither', { address: false, key: null }],
  ] as const)('refuses as not set up with %s, and sends nothing', async (_n, opts) => {
    await setUp(opts)
    expect(await check()).toEqual(NOT_SET_UP)
    expect(stand.seen).toEqual([])
  })

  it('refuses a saved test address once dev tools are off, and sends nothing', async () => {
    await setUp()
    Object.assign(f.core.deps, { devTools: false })
    expect(await check()).toEqual(NOT_SET_UP)
    expect(stand.seen).toEqual([])
  })

  it.each([
    ['bad_key', () => setUp({ key: 'made-up-wrong-key-1111' })],
    ['not_set_up', async () => (await setUp(), stand.setKey(null))],
    [
      'version',
      async () => (
        await setUp(),
        stand.once('health', { status: 200, json: { service: 'adman-approvals', contract: 9 } })
      ),
    ],
    [
      'other',
      async () => (
        await setUp(),
        stand.once('health', { status: 200, json: { service: 'other' } })
      ),
    ],
    [
      'offline',
      async () => (await setUp(), await stand.close(), (stand = await startApprovalsStandIn())),
    ],
  ] as const)('fails with the %s sentence', async (kind, arrange) => {
    await arrange()
    expect(await check()).toEqual({
      ok: false,
      error: {
        code: 'PROVIDER_ERROR',
        message: APPROVALS_FAILURE_MESSAGES[kind],
        details: { service: 'approvals', kind: kind === 'version' ? 'other' : kind },
      },
    })
    const logs = f.readLogs()
    expect(logs).toContain('"name":"approvals.request"')
    for (const secret of [KEY, 'made-up-wrong-key-1111', '127.0.0.1']) {
      expect(logs.includes(secret), secret).toBe(false)
    }
  })

  it('fails with the timeout sentence at its time limit', async () => {
    await setUp()
    stand.once('health', { wait: true })
    const handler = approvalsCheck(f.core.deps, { totalMs: 200 })
    await expect(handler.run({ actor: 'user', commandId: 'c1' }, {})).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
      message: APPROVALS_FAILURE_MESSAGES.timeout,
      details: { service: 'approvals', kind: 'timeout' },
    })
  })

  it('writes nothing and sends no event', async () => {
    await setUp()
    const before = f.events.length
    const settings = JSON.stringify(f.core.settings.get())
    await check()
    expect(f.events.slice(before)).toEqual([])
    expect(JSON.stringify(f.core.settings.get())).toBe(settings)
  })
})
