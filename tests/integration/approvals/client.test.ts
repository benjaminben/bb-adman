// The approvals service client against the stand-in (spec/approvals.md "The service client",
// "Named tests"). Every request goes to the stand-in on 127.0.0.1; nothing leaves the machine.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createApprovalsClient, type ApprovalsService } from '@/main/approvals/client'
import type { ActivityLog, LogInput } from '@/main/log/activity-log'
import { APPROVALS_FAILURE_MESSAGES, APPROVALS_REASON_MESSAGES } from '@/shared/approvals/messages'
import { startApprovalsStandIn, type ApprovalsStandIn } from '../../helpers/approvals-stand-in'

const KEY = 'made-up-approvals-key-for-the-client-test-0042'
const P = '01JD5Z8Q4N3V6W7X8Y9Z0ABCDE'
const C = 'spring-sale-abc234'
const pair = { projectId: P, campaignId: C }
const PASSWORD = 'made-up-link-password'
const link = { ...pair, campaignName: 'Spring sale', password: PASSWORD }
const variant = {
  variantKey: 'abc234',
  title: 'Square',
  sizeLine: '1080×1080 · en · png',
  version: 3,
  pictureUrl: 'https://made-up-bucket.s3.eu-west-1.amazonaws.com/a.png?X-Amz-Signature=made-up',
  pictureExpiresAt: '2026-11-28T00:00:00.000Z',
}

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

const service = (): ApprovalsService => ({ origin: stand.origin, key: KEY })
const client = (over: Partial<ApprovalsService> = {}, totalMs?: number) =>
  createApprovalsClient({ ...service(), ...over }, { allowLocalHttp: true, log, totalMs })

const failure = (kind: keyof typeof APPROVALS_FAILURE_MESSAGES) => ({
  code: 'PROVIDER_ERROR',
  message: APPROVALS_FAILURE_MESSAGES[kind],
  details: { service: 'approvals', kind: kind === 'version' ? 'other' : kind },
})

describe('the approvals client: routes [spec/approvals.md "The service client"]', () => {
  it('asks the health route', async () => {
    await expect(client().health()).resolves.toBeUndefined()
    expect(stand.seen.map((s) => [s.method, s.path])).toEqual([['GET', '/api/v1/health']])
  })

  it('makes, reads, changes and deletes a link', async () => {
    const c = client()
    const made = await c.createLink(link)
    expect(made).toEqual({ slug: expect.stringMatching(/^[0-9A-Za-z]{12}$/) })
    expect(await c.createLink(link)).toBe('exists')
    expect(await c.setPassword(pair, 'another-made-up-password')).toBe(true)
    expect(stand.links.get(`${P}/${C}`)?.sessionsEnded).toBe(1)
    expect(await c.replaceGallery(pair, { campaignName: 'Spring sale', variants: [variant] })).toBe(
      1,
    )
    const renewal = {
      variantKey: 'abc234',
      version: 3,
      pictureUrl: variant.pictureUrl,
      pictureExpiresAt: variant.pictureExpiresAt,
    }
    expect(await c.renewPictures(pair, { pictures: [renewal] })).toBe(1)
    const signoff = {
      id: 'a'.repeat(24),
      variantKey: 'abc234',
      version: 3,
      email: 'made-up@example.com',
      signedAt: '2026-11-21T10:00:00.000Z',
    }
    stand.plantSignoff(P, C, signoff)
    const state = await c.getLink(pair)
    expect(state).toMatchObject({
      slug: (made as { slug: string }).slug,
      campaignName: 'Spring sale',
    })
    expect(state?.variants).toEqual([
      { variantKey: 'abc234', version: 3, pictureExpiresAt: variant.pictureExpiresAt },
    ])
    expect(state?.signoffs).toEqual([signoff])
    expect(await c.deleteLink(pair)).toBe(true)
    expect(stand.links.size).toBe(0)
  })

  it('answers null or false on 404 not_found for every link route', async () => {
    const c = client()
    expect(await c.getLink(pair)).toBeNull()
    expect(await c.setPassword(pair, PASSWORD)).toBe(false)
    expect(await c.replaceGallery(pair, { campaignName: 'A', variants: [] })).toBeNull()
    expect(await c.deleteLink(pair)).toBe(false)
    expect(lines).toEqual([])
  })

  it('refuses bad IDs and bodies before any request', async () => {
    const c = client()
    const refused = { code: 'INVALID_INPUT' }
    await expect(c.getLink({ projectId: '../x', campaignId: C })).rejects.toMatchObject(refused)
    await expect(c.deleteLink({ projectId: P, campaignId: 'a/../b-abc234' })).rejects.toMatchObject(
      refused,
    )
    await expect(c.createLink({ ...link, password: 'short' })).rejects.toMatchObject(refused)
    await expect(c.replaceGallery(pair, { campaignName: '', variants: [] })).rejects.toMatchObject(
      refused,
    )
    expect(stand.seen).toEqual([])
  })
})

describe('the approvals client: what it sends [spec/approvals.md "Named tests"]', () => {
  it('puts the key only in the Authorization header, and sends no Origin, Referer or Cookie', async () => {
    const c = client()
    await c.health()
    await c.createLink(link)
    await c.getLink(pair)
    for (const s of stand.seen) {
      expect(s.headers.authorization).toBe(`Bearer ${KEY}`)
      const others = Object.entries(s.headers).filter(([name]) => name !== 'authorization')
      expect(JSON.stringify(others)).not.toContain(KEY)
      expect(s.path).not.toContain(KEY)
      expect(s.body).not.toContain(KEY)
      expect(s.headers.origin).toBeUndefined()
      expect(s.headers.referer).toBeUndefined()
      expect(s.headers.cookie).toBeUndefined()
      expect(s.headers['user-agent']).toBe('Adman')
    }
  })

  it('does not follow a redirect: one request, kind other', async () => {
    stand.once('health', { redirect: `${stand.origin}/api/v1/health` })
    await expect(client().health()).rejects.toMatchObject(failure('other'))
    expect(stand.seen).toHaveLength(1)
  })

  it('refuses a 5 MiB reply', async () => {
    const json = { service: 'adman-approvals', contract: 1 }
    const c = client()
    stand.once('health', { oversized: 4 * 1024 * 1024 - 1, json })
    await expect(c.health()).resolves.toBeUndefined()
    stand.once('health', { oversized: 5 * 1024 * 1024, json })
    await expect(c.health()).rejects.toMatchObject(failure('other'))
    stand.once('health', { oversized: 5 * 1024 * 1024, json, chunked: true })
    await expect(c.health()).rejects.toMatchObject(failure('other'))
  })

  it('refuses the stand-in on plain http without dev tools, and sends nothing', async () => {
    const c = createApprovalsClient(service(), { allowLocalHttp: false, log })
    await expect(c.health()).rejects.toMatchObject({
      code: 'RULE_VIOLATION',
      message: APPROVALS_REASON_MESSAGES.approvals_not_set_up,
    })
    expect(stand.seen).toEqual([])
  })

  it('sends only to the saved origin, checked again at call time', async () => {
    for (const origin of ['http://localhost:1', `${stand.origin}/api`, 'http://10.0.0.1:80']) {
      await expect(client({ origin }).health()).rejects.toMatchObject({ code: 'RULE_VIOLATION' })
    }
    expect(stand.seen).toEqual([])
  })
})

describe('the approvals client: failures [spec/approvals.md "The service client"]', () => {
  it.each([
    ['401 bad_key', () => client({ key: 'made-up-wrong-key-0000' }).health(), 'bad_key', 401],
    ['503 not_set_up', () => (stand.setKey(null), client().health()), 'not_set_up', 503],
    [
      'another contract number',
      () => (
        stand.once('health', { status: 200, json: { service: 'adman-approvals', contract: 2 } }),
        client().health()
      ),
      'version',
      200,
    ],
    [
      'a reply of the wrong shape',
      () => (stand.once('getLink', { status: 200, json: { slug: 42 } }), client().getLink(pair)),
      'other',
      200,
    ],
    [
      'a 500',
      () => (
        stand.once('health', { status: 500, json: { error: { code: 'internal', message: 'x' } } }),
        client().health()
      ),
      'other',
      500,
    ],
    [
      'a 400',
      () => (
        stand.once('createLink', {
          status: 400,
          json: { error: { code: 'invalid_input', message: 'x' } },
        }),
        client().createLink(link)
      ),
      'other',
      400,
    ],
    [
      '404 on health',
      () => (
        stand.once('health', { status: 404, json: { error: { code: 'not_found', message: 'x' } } }),
        client().health()
      ),
      'other',
      404,
    ],
    [
      'a 401 without the bad_key code',
      () => (stand.once('health', { status: 401, json: {} }), client().health()),
      'other',
      401,
    ],
    [
      'the time limit',
      () => (stand.once('health', { wait: true }), client({}, 200).health()),
      'timeout',
      0,
    ],
  ] as const)(
    '%s fails with its fixed sentence and one log line',
    async (_name, act, kind, status) => {
      await expect(act()).rejects.toMatchObject(failure(kind))
      expect(lines).toEqual([
        expect.objectContaining({
          name: 'approvals.request',
          ok: false,
          context: { route: expect.any(String), kind: kind === 'version' ? 'other' : kind, status },
        }),
      ])
    },
  )

  it('is offline when nothing listens at the origin', async () => {
    const origin = stand.origin
    await stand.close()
    await expect(client({ origin }).health()).rejects.toMatchObject(failure('offline'))
    stand = await startApprovalsStandIn({ key: KEY })
  })

  it('puts no key, address, password or body in a log line or an error', async () => {
    const c = client()
    const errors: unknown[] = []
    stand.once('createLink', {
      status: 500,
      json: { error: { code: 'internal', message: 'made-up-body-text' } },
    })
    await c.createLink(link).catch((e: unknown) => errors.push(e))
    stand.once('getLink', { status: 200, json: { echoed: 'made-up-body-text' } })
    await c.getLink(pair).catch((e: unknown) => errors.push(e))
    await client({ key: 'made-up-wrong-key-0000' })
      .health()
      .catch((e: unknown) => errors.push(e))
    expect(errors).toHaveLength(3)
    expect(lines).toHaveLength(3)
    const text =
      JSON.stringify(lines) +
      errors.map((e) => `${String(e)} ${JSON.stringify(e)} ${(e as Error).stack}`).join('\n')
    for (const secret of [
      KEY,
      'made-up-wrong-key-0000',
      stand.origin,
      '127.0.0.1',
      PASSWORD,
      'made-up-body-text',
      P,
    ]) {
      expect(text.includes(secret), secret).toBe(false)
    }
  })
})
