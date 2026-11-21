// approvals.refresh (spec/approvals-commands.md "approvals.refresh", security class): sign-offs
// read back and replaced, picture addresses renewed only when under 2 days and only for the
// version the service shows, a renewal failure that does not stop it, a gone link ended with
// its writes kept and no throw, no event when nothing changed, and a reply with a bad email
// refused. Requests go to the stand-in, pictures to the test store.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readLink, readSignoffs, readVariants } from '@/main/approvals/local-store'
import { APPROVALS_REASON_MESSAGES } from '@/shared/approvals/messages'
import { AppError } from '@/shared/schemas/result'
import { data } from '../core-fixture'
import {
  addVariants,
  makeLinkFixture,
  pair,
  setUp,
  stubDraw,
  variantsOf,
  type LinkFixture,
} from './link-fixture'

const PASSWORD = 'the-link-password-00009'
const DAY = 86_400_000
const signoff = (id: string, variantKey: string, email = 'pat@client.example.com') => ({
  id: id.repeat(24),
  variantKey,
  version: 0,
  email,
  signedAt: '2026-11-02T10:00:00.000Z',
})
let lf: LinkFixture

beforeEach(async () => {
  lf = await makeLinkFixture()
  await setUp(lf)
  for (const c of [lf.c1, lf.c2]) {
    data(await lf.f.user('approvals.createLink', { ...pair(lf, c), password: PASSWORD }))
  }
})
afterEach(() => {
  vi.restoreAllMocks()
  return lf.close()
})

const refresh = () => lf.f.user('approvals.refresh', pair(lf))
const log = () => lf.f.core.deps.log
const link = () => lf.stand.links.get(`${lf.projectId}/${lf.c1}`)
const changedEvents = (from: number) =>
  lf.f.events.slice(from).filter((e) => e.name === 'approvals.changed')
const ONE_EVENT = () => [
  { name: 'approvals.changed', payload: { projectId: lf.projectId, campaignId: lf.c1 } },
]
const setExpiry = (variantId: string, at: number) =>
  lf
    .db()
    .prepare('UPDATE approval_variant SET expires_at = ? WHERE campaign_id = ? AND variant_id = ?')
    .run(new Date(at).toISOString(), lf.c1, variantId)

async function published(extra: number): Promise<string[]> {
  addVariants(lf, lf.c1, extra)
  stubDraw(lf)
  data(await lf.f.user('approvals.publish', pair(lf)))
  return variantsOf(lf).map((v) => v.id)
}

describe('approvals.refresh [spec/approvals-commands.md "approvals.refresh"]', () => {
  it('replaces the sign-offs with the service’s list and sends one event when they change', async () => {
    const [v1 = ''] = await published(0)
    lf.stand.plantSignoff(lf.projectId, lf.c1, signoff('A', v1))
    lf.stand.plantSignoff(lf.projectId, lf.c1, signoff('B', v1, 'Sam@Client.Example.com'))
    let before = lf.f.events.length
    expect(await refresh()).toEqual({ ok: true, data: { changed: true, gone: false } })
    await Promise.resolve()
    expect(readSignoffs(lf.db(), lf.c1, log()).map((s) => [s.id[0], s.email])).toEqual([
      ['A', 'pat@client.example.com'],
      ['B', 'sam@client.example.com'],
    ])
    expect(changedEvents(before)).toEqual(ONE_EVENT())
    link()!.signoffs.shift()
    before = lf.f.events.length
    expect(await refresh()).toEqual({ ok: true, data: { changed: true, gone: false } })
    await Promise.resolve()
    expect(readSignoffs(lf.db(), lf.c1, log()).map((s) => s.id[0])).toEqual(['B'])
    expect(changedEvents(before)).toEqual(ONE_EVENT())
  })

  it('sends no event when nothing changed, and still sets checked_at', async () => {
    await published(0)
    data(await refresh())
    const checked = readLink(lf.db(), lf.c1, log())?.checkedAt
    await new Promise((r) => setTimeout(r, 5))
    const before = lf.f.events.length
    expect(await refresh()).toEqual({ ok: true, data: { changed: false, gone: false } })
    await Promise.resolve()
    expect(changedEvents(before)).toEqual([])
    expect(readLink(lf.db(), lf.c1, log())?.checkedAt).not.toBe(checked)
  })

  it('renews only addresses under 2 days away, and only for the version the service shows', async () => {
    const [soon = '', later = '', other = ''] = await published(2)
    const now = Date.now()
    setExpiry(soon, now + DAY)
    setExpiry(later, now + 3 * DAY)
    setExpiry(other, now + DAY)
    const row = link()!.gallery.find((v) => v.variantKey === other)!
    row.version = 7
    const rows = new Map(readVariants(lf.db(), lf.c1, log()).map((r) => [r.variantId, r]))
    const before = lf.f.events.length
    expect(await refresh()).toEqual({ ok: true, data: { changed: true, gone: false } })
    await Promise.resolve()
    const sent = lf.stand.seen.filter((s) => s.route === 'renewPictures')
    expect(sent).toHaveLength(1)
    const body = JSON.parse(sent[0]!.body) as { pictures: Array<{ variantKey: string }> }
    expect(body.pictures.map((p) => p.variantKey)).toEqual([soon])
    const after = new Map(readVariants(lf.db(), lf.c1, log()).map((r) => [r.variantId, r]))
    expect(Date.parse(after.get(soon)!.expiresAt)).toBeGreaterThan(now + 6 * DAY)
    expect(after.get(later)).toEqual(rows.get(later))
    expect(after.get(other)).toEqual(rows.get(other))
    expect(changedEvents(before)).toEqual(ONE_EVENT())
  })

  it('carries on when the renewal fails, logs it and tries again next time', async () => {
    const [v1 = ''] = await published(0)
    setExpiry(v1, Date.now() + DAY)
    const was = readVariants(lf.db(), lf.c1, log())
    lf.stand.plantSignoff(lf.projectId, lf.c1, signoff('C', v1))
    lf.stand.once('renewPictures', {
      status: 500,
      json: { error: { code: 'internal', message: 'x' } },
    })
    expect(await refresh()).toEqual({ ok: true, data: { changed: true, gone: false } })
    expect(readSignoffs(lf.db(), lf.c1, log()).map((s) => s.id[0])).toEqual(['C'])
    expect(readVariants(lf.db(), lf.c1, log())).toEqual(was)
    expect(lf.f.readLogs()).toContain('refreshRenew')
    data(await refresh())
    expect(lf.stand.seen.filter((s) => s.route === 'renewPictures')).toHaveLength(2)
    expect(readVariants(lf.db(), lf.c1, log())).not.toEqual(was)
  })

  it('ends a gone link here, keeps its writes and sign-offs, and does not throw', async () => {
    const [v1 = ''] = await published(0)
    lf.stand.plantSignoff(lf.projectId, lf.c1, signoff('D', v1))
    data(await refresh())
    lf.stand.links.delete(`${lf.projectId}/${lf.c1}`)
    const before = lf.f.events.length
    const sent = lf.stand.seen.length
    expect(await refresh()).toEqual({ ok: true, data: { changed: true, gone: true } })
    await Promise.resolve()
    expect(lf.stand.seen.slice(sent).map((s) => s.route)).toEqual(['getLink'])
    expect(readLink(lf.db(), lf.c1, log())).toMatchObject({ state: 'ended' })
    expect(readLink(lf.db(), lf.c1, log())?.endedAt).toEqual(expect.any(String))
    expect(readVariants(lf.db(), lf.c1, log())).toEqual([])
    expect(readSignoffs(lf.db(), lf.c1, log()).map((s) => s.id[0])).toEqual(['D'])
    expect(lf.f.core.deps.approvals.passwords.read(lf.projectId, lf.c1)).toBeNull()
    expect(lf.f.core.deps.approvals.passwords.read(lf.projectId, lf.c2)).toBe(PASSWORD)
    expect(changedEvents(before)).toEqual(ONE_EVENT())
  })

  it('still ends a gone link when the password cannot be forgotten', async () => {
    lf.stand.links.delete(`${lf.projectId}/${lf.c1}`)
    vi.spyOn(lf.f.core.deps.approvals.passwords, 'forget').mockImplementationOnce(() => {
      throw new AppError('RULE_VIOLATION', 'The saved keys could not be read.')
    })
    expect(await refresh()).toEqual({ ok: true, data: { changed: true, gone: true } })
    await Promise.resolve()
    expect(readLink(lf.db(), lf.c1, log())).toMatchObject({ state: 'ended' })
    expect(lf.f.readLogs()).toContain('afterCommit')
  })

  it.each([
    ['the service fails', 'service'],
    ['the local write of a gone link fails', 'write'],
  ])('sends no event and forgets nothing when %s', async (_n, how) => {
    const db = lf.db()
    if (how === 'service') {
      lf.stand.once('getLink', { status: 500, json: { error: { code: 'internal', message: 'x' } } })
    } else {
      lf.stand.links.delete(`${lf.projectId}/${lf.c1}`)
      db.exec(
        "CREATE TRIGGER no_end BEFORE UPDATE ON approval_link BEGIN SELECT RAISE(ABORT, 'no'); END",
      )
    }
    const before = lf.f.events.length
    expect((await refresh()).ok).toBe(false)
    await Promise.resolve()
    expect(changedEvents(before)).toEqual([])
    expect(readLink(db, lf.c1, log())).toMatchObject({ state: 'live' })
    expect(lf.f.core.deps.approvals.passwords.read(lf.projectId, lf.c1)).toBe(PASSWORD)
  })

  it.each([
    ['a script-bearing email', '<script>alert(1)</script>@client.example.com'],
    ['a non-ASCII email', 'pаt@client.example.com'],
  ])('refuses a service reply with %s as other and keeps the sign-offs', async (_n, email) => {
    const [v1 = ''] = await published(0)
    lf.stand.plantSignoff(lf.projectId, lf.c1, signoff('E', v1))
    data(await refresh())
    lf.stand.plantSignoff(lf.projectId, lf.c1, signoff('F', v1, email))
    expect(await refresh()).toMatchObject({
      ok: false,
      error: { code: 'PROVIDER_ERROR', details: { service: 'approvals', kind: 'other' } },
    })
    expect(readSignoffs(lf.db(), lf.c1, log()).map((s) => s.id[0])).toEqual(['E'])
    expect(lf.f.readLogs()).not.toContain(email)
  })

  it('needs no bucket, and refuses a campaign with no live link', async () => {
    lf.f.core.settings.update({ storage: { s3: null } })
    expect(await refresh()).toEqual({ ok: true, data: { changed: false, gone: false } })
    data(await lf.f.user('approvals.endLink', pair(lf)))
    const sent = lf.stand.seen.length
    expect(await refresh()).toEqual({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: APPROVALS_REASON_MESSAGES.approval_link_missing,
        details: { reason: 'approval_link_missing' },
      },
    })
    expect(lf.stand.seen.length).toBe(sent)
  })
})
