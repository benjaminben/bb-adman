// approvals.setPassword (spec/approvals.md "approvals.setPassword", security class): the given
// or a made password is sent (the service ends every visitor session) and kept. No table
// changes. Every request goes to the stand-in.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PASSWORD_ALPHABET } from '@/main/approvals/make-password'
import { readLink } from '@/main/approvals/local-store'
import {
  APPROVALS_PASSWORD_MESSAGE,
  APPROVALS_REASON_MESSAGES,
  type ApprovalsReason,
} from '@/shared/approvals/messages'
import { data } from '../core-fixture'
import { makeLinkFixture, pair, setUp, type LinkFixture, type SetUpParts } from './link-fixture'

const FIRST = 'the-first-password-0001'
const NEXT = 'the-next-password-00002'
let lf: LinkFixture

beforeEach(async () => {
  lf = await makeLinkFixture()
})
afterEach(() => lf.close())

const setPassword = (over: Record<string, unknown> = {}) =>
  lf.f.user('approvals.setPassword', { ...pair(lf), ...over })
const refusal = (reason: ApprovalsReason) => ({
  ok: false,
  error: {
    code: 'RULE_VIOLATION',
    message: APPROVALS_REASON_MESSAGES[reason],
    details: { reason },
  },
})
const standLink = () => lf.stand.links.get(`${lf.projectId}/${lf.c1}`)
const kept = () => lf.f.core.deps.approvals.passwords.read(lf.projectId, lf.c1)

async function withLink() {
  await setUp(lf)
  data(await lf.f.user('approvals.createLink', { ...pair(lf), password: FIRST }))
  return lf.stand.seen.length
}

describe('approvals.setPassword [spec/approvals.md "approvals.setPassword"]', () => {
  it('sends the given password, keeps it, and the service ends its sessions', async () => {
    await withLink()
    const before = lf.f.events.length
    const reply = await setPassword({ password: NEXT })
    expect(reply).toEqual({ ok: true, data: {} })
    expect(standLink()).toMatchObject({ password: NEXT, sessionsEnded: 1 })
    expect(kept()).toBe(NEXT)
    expect(lf.f.events.slice(before)).toEqual([
      { name: 'approvals.changed', payload: { projectId: lf.projectId, campaignId: lf.c1 } },
    ])
    expect(JSON.stringify(lf.f.events) + lf.f.readLogs()).not.toContain(NEXT)
  })

  it('makes a password when none is given', async () => {
    await withLink()
    data(await setPassword())
    const sent = standLink()?.password ?? ''
    expect(sent).toMatch(new RegExp(`^[${PASSWORD_ALPHABET}]{4}(-[${PASSWORD_ALPHABET}]{4}){3}$`))
    expect(kept()).toBe(sent)
  })

  it('changes no table', async () => {
    await withLink()
    const link = readLink(lf.db(), lf.c1, lf.f.core.deps.log)
    data(await setPassword({ password: NEXT }))
    expect(readLink(lf.db(), lf.c1, lf.f.core.deps.log)).toEqual(link)
  })

  it('refuses a bad chosen password in its own sentence and sends nothing', async () => {
    const sent = await withLink()
    expect(await setPassword({ password: 'short\n' })).toEqual({
      ok: false,
      error: { code: 'INVALID_INPUT', message: APPROVALS_PASSWORD_MESSAGE },
    })
    expect(lf.stand.seen).toHaveLength(sent)
    expect(kept()).toBe(FIRST)
  })

  it.each([
    ['an unknown campaign', {}, { campaignId: 'other-campaign-abc234' }],
    ['no service', { service: false }, {}],
    ['no link', {}, {}],
  ] as Array<[string, SetUpParts, Record<string, unknown>]>)(
    'refuses %s in order and sends nothing',
    async (name, parts, over) => {
      await setUp(lf, parts)
      const reply = await setPassword({ password: NEXT, ...over })
      if (name === 'an unknown campaign') {
        expect(reply).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
      } else if (name === 'no service') {
        expect(reply).toEqual(refusal('approvals_not_set_up'))
      } else {
        expect(reply).toEqual(refusal('approval_link_missing'))
      }
      expect(lf.stand.seen).toEqual([])
    },
  )

  it('needs no bucket', async () => {
    await withLink()
    lf.f.core.settings.update({ storage: { s3: null } })
    data(await setPassword({ password: NEXT }))
  })

  it('refuses as gone, keeping the old password, when the service no longer has the link', async () => {
    await withLink()
    lf.stand.links.delete(`${lf.projectId}/${lf.c1}`)
    expect(await setPassword({ password: NEXT })).toEqual(refusal('approval_link_gone'))
    expect(kept()).toBe(FIRST)
  })
})

describe('approvals.setPassword events and secure storage [AP-8 rulings]', () => {
  const changedEvents = (from: number) =>
    lf.f.events.slice(from).filter((e) => e.name === 'approvals.changed')

  it.each([
    ['a bad password', async () => setPassword({ password: 'short' })],
    [
      'a service failure',
      async () => {
        lf.stand.once('setPassword', {
          status: 500,
          json: { error: { code: 'internal', message: 'x' } },
        })
        return setPassword({ password: NEXT })
      },
    ],
    [
      'a password store that fails',
      async () => {
        vi.spyOn(lf.f.core.deps.approvals.passwords, 'keep').mockImplementationOnce(() => {
          throw new Error('disk full')
        })
        return setPassword({ password: NEXT })
      },
    ],
  ])('sends no approvals.changed after %s', async (_n, act) => {
    await withLink()
    const before = lf.f.events.length
    expect((await act()).ok).toBe(false)
    await Promise.resolve()
    expect(changedEvents(before)).toEqual([])
  })

  it('refuses with the store sentence and sends no request when passwords cannot be kept', async () => {
    const sent = await withLink()
    vi.spyOn(lf.f.core.deps.approvals.passwords, 'canKeep').mockReturnValue(false)
    expect(await setPassword({ password: NEXT })).toEqual({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: 'This computer cannot store keys securely.',
        details: { reason: 'secure_storage_unavailable' },
      },
    })
    expect(lf.stand.seen).toHaveLength(sent)
    expect(kept()).toBe(FIRST)
  })
})
