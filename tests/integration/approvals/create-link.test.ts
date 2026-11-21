// approvals.createLink (spec/approvals.md "approvals.createLink", security class): the shared
// refusals in order, the password (chosen or made), the 409 take-over, an ended link replaced,
// the password kept, approvals.changed sent. Every request goes to the stand-in.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PASSWORD_ALPHABET } from '@/main/approvals/make-password'
import { endLocalLink, readLink, readSignoffs } from '@/main/approvals/local-store'
import {
  APPROVALS_PASSWORD_MESSAGE,
  APPROVALS_REASON_MESSAGES,
  type ApprovalsReason,
} from '@/shared/approvals/messages'
import { AppError } from '@/shared/schemas/result'
import { data } from '../core-fixture'
import { makeLinkFixture, pair, setUp, type LinkFixture, type SetUpParts } from './link-fixture'

const CHOSEN = 'correct-horse-battery-12'
let lf: LinkFixture

beforeEach(async () => {
  lf = await makeLinkFixture()
})
afterEach(() => lf.close())

const create = (over: Record<string, unknown> = {}) =>
  lf.f.user('approvals.createLink', { ...pair(lf), ...over })
const refusal = (reason: ApprovalsReason) => ({
  ok: false,
  error: {
    code: 'RULE_VIOLATION',
    message: APPROVALS_REASON_MESSAGES[reason],
    details: { reason },
  },
})
const apiCalls = () => lf.stand.seen.filter((s) => s.route !== 'health')
const kept = (campaignId = lf.c1) =>
  lf.f.core.deps.approvals.passwords.read(lf.projectId, campaignId)
const madeShape = new RegExp(`^[${PASSWORD_ALPHABET}]{4}(-[${PASSWORD_ALPHABET}]{4}){3}$`)

describe('approvals.createLink refusals, in order [spec/approvals.md "Commands"]', () => {
  it.each([
    ['an unknown campaign, before anything else', {}, { campaignId: 'other-campaign-abc234' }],
    ['no service, before the bucket', { service: false, bucket: false, s3Keys: false }, {}],
    ['no bucket, before the S3 keys', { bucket: false, s3Keys: false }, {}],
    ['no S3 keys', { s3Keys: false }, {}],
  ] as Array<[string, SetUpParts, Record<string, unknown>]>)(
    'refuses %s and sends nothing',
    async (name, parts, over) => {
      await setUp(lf, parts)
      const reply = await create(over)
      if (name.startsWith('an unknown')) {
        expect(reply).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
      } else if (name.startsWith('no service')) {
        expect(reply).toEqual(refusal('approvals_not_set_up'))
      } else if (name.startsWith('no bucket')) {
        expect(reply).toEqual(refusal('approvals_needs_bucket'))
      } else {
        expect(reply).toMatchObject({
          ok: false,
          error: { code: 'NEEDS_KEY', details: { provider: 's3' } },
        })
      }
      expect(apiCalls()).toEqual([])
      expect(readLink(lf.db(), lf.c1, lf.f.core.deps.log)).toBeNull()
    },
  )

  it('refuses a campaign with a live link last, and sends nothing more', async () => {
    await setUp(lf)
    data(await create())
    const sent = apiCalls().length
    expect(await create()).toEqual(refusal('approval_link_exists'))
    expect(apiCalls()).toHaveLength(sent)
  })
})

describe('approvals.createLink passwords [spec/approvals.md "approvals.createLink" step 1]', () => {
  it.each([
    ['11 characters', 'a'.repeat(11)],
    ['129 characters', 'a'.repeat(129)],
    ['a line break', 'twelve-chars\nmore-text'],
    ['a tab', 'twelve-chars\tmore-text'],
  ])('refuses a chosen password with %s, in its own sentence, sending nothing', async (_n, pw) => {
    await setUp(lf)
    const reply = await create({ password: pw })
    expect(reply).toEqual({
      ok: false,
      error: { code: 'INVALID_INPUT', message: APPROVALS_PASSWORD_MESSAGE },
    })
    expect(JSON.stringify(reply)).not.toContain(pw)
    expect(lf.f.readLogs()).not.toContain(pw.replace(/\s/g, ''))
    expect(apiCalls()).toEqual([])
  })

  it('checks the password before the shared refusals', async () => {
    expect(await create({ password: 'short' })).toMatchObject({
      error: { code: 'INVALID_INPUT', message: APPROVALS_PASSWORD_MESSAGE },
    })
  })

  it('accepts 12 and 128 characters', async () => {
    await setUp(lf)
    data(await create({ password: 'a'.repeat(12) }))
    data(await create({ campaignId: lf.c2, password: 'b'.repeat(128) }))
  })

  it('sends and keeps a chosen password, and replies with the slug only', async () => {
    await setUp(lf)
    const reply = data<{ slug: string }>(await create({ password: CHOSEN }))
    const link = lf.stand.links.get(`${lf.projectId}/${lf.c1}`)
    expect(reply).toEqual({ slug: link?.slug })
    expect(link?.password).toBe(CHOSEN)
    expect(link?.campaignName).toBe('Spring Sale')
    expect(kept()).toBe(CHOSEN)
  })

  it('makes a password of four groups of four from the alphabet when none is given', async () => {
    await setUp(lf)
    data(await create())
    const sent = lf.stand.links.get(`${lf.projectId}/${lf.c1}`)?.password ?? ''
    expect(sent).toMatch(madeShape)
    expect(kept()).toBe(sent)
  })

  it('puts no password in the reply, an event or a log line', async () => {
    await setUp(lf)
    const reply = await create({ password: CHOSEN })
    data(await create({ campaignId: lf.c2 }))
    const made = kept(lf.c2) ?? ''
    const seen = JSON.stringify([reply, lf.f.events]) + lf.f.readLogs()
    for (const pw of [CHOSEN, made]) expect(seen).not.toContain(pw)
  })
})

describe('approvals.createLink writes [spec/approvals.md "approvals.createLink" steps 2-4]', () => {
  it('writes a live link and sends approvals.changed with the IDs only', async () => {
    await setUp(lf)
    const before = lf.f.events.length
    const { slug } = data<{ slug: string }>(await create())
    expect(readLink(lf.db(), lf.c1, lf.f.core.deps.log)).toMatchObject({ slug, state: 'live' })
    expect(lf.f.events.slice(before)).toEqual([
      { name: 'approvals.changed', payload: { projectId: lf.projectId, campaignId: lf.c1 } },
    ])
  })

  it('takes over a link the service already has (409), with this password', async () => {
    await setUp(lf)
    lf.stand.links.set(`${lf.projectId}/${lf.c1}`, {
      slug: 'Taken0ver0Ab',
      campaignName: 'Spring Sale',
      password: 'a-password-from-another-copy',
      createdAt: '2026-11-01T10:00:00.000Z',
      gallery: [],
      signoffs: [],
      sessionsEnded: 0,
    })
    expect(data(await create({ password: CHOSEN }))).toEqual({ slug: 'Taken0ver0Ab' })
    const link = lf.stand.links.get(`${lf.projectId}/${lf.c1}`)
    expect(link).toMatchObject({ password: CHOSEN, sessionsEnded: 1 })
    const linkPath = `/api/v1/links/${lf.projectId}/${lf.c1}`
    expect(apiCalls().map((s) => [s.route, s.method, s.path])).toEqual([
      ['createLink', 'POST', '/api/v1/links'],
      ['setPassword', 'PUT', `${linkPath}/password`],
      ['getLink', 'GET', linkPath],
    ])
    expect(readLink(lf.db(), lf.c1, lf.f.core.deps.log)).toMatchObject({
      slug: 'Taken0ver0Ab',
      state: 'live',
    })
    expect(kept()).toBe(CHOSEN)
  })

  it('replaces an ended link with a new slug and clears its kept sign-offs', async () => {
    await setUp(lf)
    const first = data<{ slug: string }>(await create())
    const db = lf.db()
    const signoff = {
      id: 'S'.repeat(24),
      variantId: (db.prepare('SELECT id FROM variant LIMIT 1').get() as { id: string }).id,
      version: 1,
      email: 'pat@client.example.com',
      signedAt: '2026-11-02T10:00:00.000Z',
    }
    endLocalLink(db, lf.c1, '2026-11-03T10:00:00.000Z', [signoff])
    lf.stand.links.delete(`${lf.projectId}/${lf.c1}`)
    const second = data<{ slug: string }>(await create())
    expect(second.slug).not.toBe(first.slug)
    expect(readLink(db, lf.c1, lf.f.core.deps.log)).toMatchObject({
      slug: second.slug,
      state: 'live',
      endedAt: null,
    })
    expect(readSignoffs(db, lf.c1, lf.f.core.deps.log)).toEqual([])
  })

  it('recovers when the link was made but the local write failed: the next press takes it over', async () => {
    await setUp(lf)
    const passwords = lf.f.core.deps.approvals.passwords
    vi.spyOn(passwords, 'keep').mockImplementationOnce(() => {
      throw new AppError('RULE_VIOLATION', 'This computer cannot store keys securely.')
    })
    const before = lf.f.events.length
    expect(await create()).toMatchObject({ ok: false, error: { code: 'RULE_VIOLATION' } })
    await Promise.resolve()
    expect(lf.f.events.slice(before).filter((e) => e.name === 'approvals.changed')).toEqual([])
    expect(readLink(lf.db(), lf.c1, lf.f.core.deps.log)).toBeNull()
    const made = lf.stand.links.get(`${lf.projectId}/${lf.c1}`)?.slug
    expect(data(await create({ password: CHOSEN }))).toEqual({ slug: made })
    expect(kept()).toBe(CHOSEN)
    expect(lf.stand.links.get(`${lf.projectId}/${lf.c1}`)?.password).toBe(CHOSEN)
  })

  it('fails with nothing written when the service fails', async () => {
    await setUp(lf)
    lf.stand.once('createLink', {
      status: 500,
      json: { error: { code: 'internal', message: 'x' } },
    })
    expect(await create()).toMatchObject({ ok: false, error: { code: 'PROVIDER_ERROR' } })
    expect(readLink(lf.db(), lf.c1, lf.f.core.deps.log)).toBeNull()
    expect(kept()).toBeNull()
  })

  it('takes over through 409 when the stored link row cannot be read, leaking nothing', async () => {
    await setUp(lf)
    const { slug } = data<{ slug: string }>(await create())
    const bad = "javascript:alert('x')"
    lf.db().prepare('UPDATE approval_link SET slug = ? WHERE campaign_id = ?').run(bad, lf.c1)
    const sent = apiCalls().length
    const reply = await create({ password: CHOSEN })
    expect(reply).toEqual({ ok: true, data: { slug } })
    expect(
      apiCalls()
        .slice(sent)
        .map((s) => s.route),
    ).toEqual(['createLink', 'setPassword', 'getLink'])
    expect(readLink(lf.db(), lf.c1, lf.f.core.deps.log)).toMatchObject({ slug, state: 'live' })
    expect(JSON.stringify([reply, lf.f.events]) + lf.f.readLogs()).not.toContain(bad)
  })
})

describe('approvals.createLink secure storage first [AP-8 ruling]', () => {
  it('refuses with the store sentence and sends no request when passwords cannot be kept', async () => {
    await setUp(lf)
    vi.spyOn(lf.f.core.deps.approvals.passwords, 'canKeep').mockReturnValue(false)
    expect(await create({ password: CHOSEN })).toEqual({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: 'This computer cannot store keys securely.',
        details: { reason: 'secure_storage_unavailable' },
      },
    })
    expect(lf.stand.seen).toEqual([])
  })

  it('asks after the shared refusals', async () => {
    await setUp(lf, { service: false })
    vi.spyOn(lf.f.core.deps.approvals.passwords, 'canKeep').mockReturnValue(false)
    expect(await create()).toEqual(refusal('approvals_not_set_up'))
  })
})
