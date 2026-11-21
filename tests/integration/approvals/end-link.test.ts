// approvals.endLink, "Turn off link" (spec/approvals.md "approvals.endLink", security class):
// a last read of sign-offs kept, the link deleted on the service, the campaign's picture folder
// emptied and nothing beside it touched, the password forgotten, and a link already gone on the
// service still ended here. Every request goes to the stand-in; pictures to the test store.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readLink, readSignoffs, readVariants } from '@/main/approvals/local-store'
import { TEST_PICTURES_FOLDER } from '@/main/approvals/test-picture-store'
import { pictureFolder, picturePath } from '@/shared/approvals/picture-paths'
import { APPROVALS_REASON_MESSAGES, type ApprovalsReason } from '@/shared/approvals/messages'
import { AppError } from '@/shared/schemas/result'
import { data } from '../core-fixture'
import { makeLinkFixture, pair, setUp, type LinkFixture, type SetUpParts } from './link-fixture'

const PASSWORD = 'the-link-password-00001'
const SIGNOFF = {
  id: 'Q'.repeat(24),
  variantKey: 'k3f9q2',
  version: 2,
  email: 'pat@client.example.com',
  signedAt: '2026-11-02T10:00:00.000Z',
}
let lf: LinkFixture

beforeEach(async () => {
  lf = await makeLinkFixture()
})
afterEach(() => {
  vi.restoreAllMocks()
  return lf.close()
})

const end = (campaignId = lf.c1) => lf.f.user('approvals.endLink', pair(lf, campaignId))
const refusal = (reason: ApprovalsReason) => ({
  ok: false,
  error: {
    code: 'RULE_VIOLATION',
    message: APPROVALS_REASON_MESSAGES[reason],
    details: { reason },
  },
})
const key = (campaignId = lf.c1) => `${lf.projectId}/${campaignId}`
const log = () => lf.f.core.deps.log
const root = () => path.join(lf.f.userData, TEST_PICTURES_FOLDER)
const onDisk = (rel: string) => fs.existsSync(path.join(root(), rel))
const kept = (campaignId = lf.c1) =>
  lf.f.core.deps.approvals.passwords.read(lf.projectId, campaignId)

async function withLinks() {
  await setUp(lf)
  for (const c of [lf.c1, lf.c2]) {
    data(await lf.f.user('approvals.createLink', { ...pair(lf, c), password: PASSWORD }))
  }
}

async function plantPictures() {
  const store = lf.f.core.deps.approvals.pictures()
  const png = new Uint8Array([137, 80, 78, 71])
  const mine = [
    picturePath(lf.projectId, lf.c1, 'k3f9q2', 1),
    picturePath(lf.projectId, lf.c1, 'k3f9q2', 2),
  ]
  const theirs = picturePath(lf.projectId, lf.c2, 'k3f9q2', 1)
  for (const p of [...mine, theirs]) await store.put(p, png)
  // Beside the campaign folder: a file next to it and a folder whose name starts the same.
  const beside = [
    `${pictureFolder(lf.projectId, lf.c1).slice(0, -1)}.png`,
    `${pictureFolder(lf.projectId, lf.c1).slice(0, -1)}-old/k3f9q2-1.png`,
  ]
  for (const rel of beside) {
    fs.mkdirSync(path.dirname(path.join(root(), rel)), { recursive: true })
    fs.writeFileSync(path.join(root(), rel), png)
  }
  return { mine, theirs, beside }
}

describe('approvals.endLink [spec/approvals.md "approvals.endLink"]', () => {
  it('keeps a last read of sign-offs, ends the link here and sends approvals.changed', async () => {
    await withLinks()
    lf.stand.plantSignoff(lf.projectId, lf.c1, SIGNOFF)
    const before = lf.f.events.length
    expect(await end()).toEqual({ ok: true, data: {} })
    const { variantKey, ...rest } = SIGNOFF
    expect(readSignoffs(lf.db(), lf.c1, log())).toEqual([{ ...rest, variantId: variantKey }])
    expect(readLink(lf.db(), lf.c1, log())).toMatchObject({ state: 'ended' })
    expect(readLink(lf.db(), lf.c1, log())?.endedAt).toEqual(expect.any(String))
    expect(readVariants(lf.db(), lf.c1, log())).toEqual([])
    expect(lf.f.events.slice(before)).toEqual([
      { name: 'approvals.changed', payload: { projectId: lf.projectId, campaignId: lf.c1 } },
    ])
  })

  it("deletes only this campaign's link on the service", async () => {
    await withLinks()
    data(await end())
    expect(lf.stand.links.has(key())).toBe(false)
    expect(lf.stand.links.has(key(lf.c2))).toBe(true)
    expect(lf.stand.seen.filter((s) => s.route === 'deleteLink').map((s) => s.path)).toEqual([
      `/api/v1/links/${lf.projectId}/${lf.c1}`,
    ])
    expect(readLink(lf.db(), lf.c2, log())).toMatchObject({ state: 'live' })
  })

  it("empties the campaign's picture folder and touches nothing beside it", async () => {
    await withLinks()
    const { mine, theirs, beside } = await plantPictures()
    for (const p of [...mine, theirs, ...beside]) expect(onDisk(p)).toBe(true)
    data(await end())
    for (const p of mine) expect(onDisk(p)).toBe(false)
    for (const p of [theirs, ...beside]) expect(onDisk(p)).toBe(true)
  })

  it('forgets the password, and only this one', async () => {
    await withLinks()
    data(await end())
    expect(kept()).toBeNull()
    expect(kept(lf.c2)).toBe(PASSWORD)
  })

  it('still ends a link the service no longer has, without the service steps', async () => {
    await withLinks()
    const { mine } = await plantPictures()
    lf.stand.links.delete(key())
    const sent = lf.stand.seen.length
    data(await end())
    expect(lf.stand.seen.slice(sent).map((s) => s.route)).toEqual(['getLink'])
    expect(readLink(lf.db(), lf.c1, log())).toMatchObject({ state: 'ended' })
    expect(kept()).toBeNull()
    for (const p of mine) expect(onDisk(p)).toBe(false)
  })

  it('does not fail when the pictures cannot be removed, and logs it once', async () => {
    await withLinks()
    vi.spyOn(lf.f.core.deps.approvals, 'pictures').mockImplementation(() => {
      throw new AppError('NEEDS_KEY', 'Add your Amazon S3 key.', { provider: 's3' })
    })
    data(await end())
    expect(readLink(lf.db(), lf.c1, log())).toMatchObject({ state: 'ended' })
    const lines = lf.f
      .readLogs()
      .split('\n')
      .filter((l) => l.includes('approvals.pictures'))
    expect(lines).toHaveLength(1)
  })

  it('changes nothing when the service fails to delete, and works when pressed again', async () => {
    await withLinks()
    lf.stand.once('deleteLink', {
      status: 500,
      json: { error: { code: 'internal', message: 'x' } },
    })
    expect(await end()).toMatchObject({ ok: false, error: { code: 'PROVIDER_ERROR' } })
    expect(readLink(lf.db(), lf.c1, log())).toMatchObject({ state: 'live' })
    expect(kept()).toBe(PASSWORD)
    data(await end())
    expect(lf.stand.links.has(key())).toBe(false)
  })

  it('still ends the link and keeps the last read when the password cannot be forgotten', async () => {
    await withLinks()
    lf.stand.plantSignoff(lf.projectId, lf.c1, SIGNOFF)
    vi.spyOn(lf.f.core.deps.approvals.passwords, 'forget').mockImplementationOnce(() => {
      throw new AppError('RULE_VIOLATION', 'The saved keys could not be read.')
    })
    const slug = lf.stand.links.get(key())?.slug ?? ''
    expect(await end()).toEqual({ ok: true, data: {} })
    await Promise.resolve()
    expect(lf.stand.links.has(key())).toBe(false)
    expect(readLink(lf.db(), lf.c1, log())).toMatchObject({ state: 'ended' })
    expect(readSignoffs(lf.db(), lf.c1, log()).map((s) => s.id)).toEqual([SIGNOFF.id])
    const logs = lf.f.readLogs()
    expect(logs).toContain('afterCommit')
    for (const secret of [PASSWORD, slug, SIGNOFF.email]) expect(logs).not.toContain(secret)
  })

  it('recovers when the service deleted the link but the local write failed', async () => {
    await withLinks()
    const db = lf.db()
    db.exec(
      "CREATE TRIGGER no_end BEFORE UPDATE ON approval_link BEGIN SELECT RAISE(ABORT, 'no'); END",
    )
    const before = lf.f.events.length
    expect((await end()).ok).toBe(false)
    await Promise.resolve()
    expect(lf.f.events.slice(before).filter((e) => e.name === 'approvals.changed')).toEqual([])
    expect(lf.stand.links.has(key())).toBe(false)
    expect(readLink(db, lf.c1, log())).toMatchObject({ state: 'live' })
    expect(kept()).toBe(PASSWORD)
    db.exec('DROP TRIGGER no_end')
    data(await end())
    expect(readLink(db, lf.c1, log())).toMatchObject({ state: 'ended' })
    expect(kept()).toBeNull()
  })

  it.each([
    ['an unknown campaign', {}, 'other-campaign-abc234'],
    ['no service', { service: false }, undefined],
    ['no link', {}, undefined],
  ] as Array<[string, SetUpParts, string | undefined]>)(
    'refuses %s in order and sends nothing',
    async (name, parts, campaignId) => {
      await setUp(lf, parts)
      const reply = await end(campaignId)
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

  it('refuses a link that is already ended', async () => {
    await withLinks()
    data(await end())
    expect(await end()).toEqual(refusal('approval_link_missing'))
  })
})
