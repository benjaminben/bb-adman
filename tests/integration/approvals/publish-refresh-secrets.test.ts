// spec/approvals.md "Rules a developer must not break": a signed picture address, the service
// key, a link password and a reviewer's email never reach a log line, an event or a reply.
// Publish and refresh run through success, failure, renewal and a gone link with each value
// planted, then the logs, the events and the replies are searched for them.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { PictureStore } from '@/main/approvals/types'
import { data } from '../core-fixture'
import {
  KEY,
  makeLinkFixture,
  pair,
  setUp,
  stubDraw,
  variantsOf,
  type LinkFixture,
} from './link-fixture'

const PASSWORD = 'the-link-password-secret-0009'
const SIGNATURE = 'a1b2c3d4e5f60718293a4b5c6d7e8f90signature'
const EMAIL = 'reviewer.secret@client.example.com'
let lf: LinkFixture

beforeEach(async () => {
  lf = await makeLinkFixture()
  await setUp(lf)
  data(await lf.f.user('approvals.createLink', { ...pair(lf), password: PASSWORD }))
  const real = lf.f.core.deps.approvals.pictures()
  // A signed address shaped as S3 gives it, with the signature planted.
  const store: PictureStore = {
    ...real,
    signedUrl: async (p, s) => {
      const signed = await real.signedUrl(p, s)
      return { ...signed, url: `${signed.url}?X-Amz-Signature=${SIGNATURE}` }
    },
  }
  vi.spyOn(lf.f.core.deps.approvals, 'pictures').mockReturnValue(store)
  stubDraw(lf)
})
afterEach(() => {
  vi.restoreAllMocks()
  return lf.close()
})

const soon = () =>
  lf
    .db()
    .prepare('UPDATE approval_variant SET expires_at = ? WHERE campaign_id = ?')
    .run(new Date(Date.now() + 3_600_000).toISOString(), lf.c1)

describe('publish and refresh keep secrets out of logs, events and replies', () => {
  it('holds no signed address, key, password or email after every path', async () => {
    const replies: unknown[] = []
    const run = async (name: string) => replies.push(await lf.f.user(name, pair(lf)))
    await run('approvals.publish')
    const [v1] = variantsOf(lf)
    lf.stand.plantSignoff(lf.projectId, lf.c1, {
      id: 'S'.repeat(24),
      variantKey: v1!.id,
      version: v1!.rev,
      email: EMAIL,
      signedAt: '2026-11-02T10:00:00.000Z',
    })
    soon()
    await run('approvals.refresh')
    soon()
    lf.stand.once('renewPictures', { status: 500, json: { error: { code: 'x', message: EMAIL } } })
    await run('approvals.refresh')
    lf.stand.once('replaceGallery', { status: 500, json: { error: { code: 'x', message: KEY } } })
    lf.db().prepare('UPDATE variant SET rev = rev + 1').run()
    await run('approvals.publish')
    lf.stand.links.delete(`${lf.projectId}/${lf.c1}`)
    await run('approvals.refresh')
    await Promise.resolve()
    const url = lf.stand.seen.find((s) => s.route === 'replaceGallery')?.body ?? ''
    expect(url).toContain(SIGNATURE)
    expect(lf.stand.seen.filter((s) => s.route === 'renewPictures')).toHaveLength(2)
    const logs = lf.f.readLogs()
    const events = JSON.stringify(lf.f.events)
    const answers = JSON.stringify(replies)
    expect(logs).toContain('approvals.publish')
    for (const secret of [SIGNATURE, KEY, PASSWORD, EMAIL, lf.stand.origin]) {
      expect(logs).not.toContain(secret)
      expect(events).not.toContain(secret)
      expect(answers).not.toContain(secret)
    }
    const changed = lf.f.events.filter((e) => e.name === 'approvals.changed')
    for (const e of changed) {
      expect(e.payload).toEqual({ projectId: lf.projectId, campaignId: lf.c1 })
    }
  })
})
