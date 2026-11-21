import { describe, it, expect, beforeEach } from 'vitest'
import { cryptoBytes } from '../src/crypto/random'
import { addSignoff } from '../src/db/signoffs'
import { putVariant } from '../src/db/variants'
import { enterLink, leaveLink, openGallery } from '../src/visitor/actions'
import { addLink, clearTables, db, enter, form, get, makeApp, PASSWORD } from './visitor-setup'

const NOW = Date.UTC(2026, 10, 21, 12, 0)
const PICTURE = 'https://my-bucket.s3.eu-west-1.amazonaws.com/p.png?X-Amz-Signature=secret'

beforeEach(clearTables)

describe('openGallery gives a narrowed view [review AP-3 Low]', () => {
  it('holds only what the page shows, with expiry worked out on the server', async () => {
    const app = makeApp(() => NOW)
    const link = await addLink(1)
    const row = { title: 'T', sizeLine: 'S', version: 3, pictureUrl: PICTURE }
    await putVariant(db, link.id, {
      ...row,
      variantKey: 'aaa234',
      position: 0,
      pictureExpiresAt: NOW + 1,
    }).run()
    await putVariant(db, link.id, {
      ...row,
      variantKey: 'bbb234',
      position: 1,
      pictureExpiresAt: NOW,
    }).run()
    const signoff = { id: 'A'.repeat(24), variantKey: 'aaa234', version: 3, email: 'a@b.co' }
    await addSignoff(db, link.id, { ...signoff, createdAt: 5 }).run()
    const cookie = await enter(app, link.slug)

    const result = await openGallery(db, get(`/l/${link.slug}?m=signed`, cookie), link.slug, NOW)
    expect(result).toEqual({
      kind: 'gallery',
      link: { slug: link.slug, campaignName: 'Campaign 1' },
      variants: [
        {
          variantKey: 'aaa234',
          position: 0,
          title: 'T',
          sizeLine: 'S',
          version: 3,
          expired: false,
        },
        { variantKey: 'bbb234', position: 1, title: 'T', sizeLine: 'S', version: 3, expired: true },
      ],
      signoffs: [{ ...signoff, createdAt: 5 }],
      m: 'signed',
    })
    const text = JSON.stringify(result)
    const secrets = [
      link.password.salt,
      link.password.hash,
      link.id,
      link.projectId,
      link.campaignId,
      PICTURE,
      'my-bucket',
    ]
    for (const secret of secrets) expect(text).not.toContain(secret)
  })
})

describe('a slug of the wrong shape is an unknown slug [review AP-3 Note]', () => {
  const parts = { now: () => NOW, random: cryptoBytes }
  const UNKNOWN = 'zzzzzzzzzzzz'

  it.each(['../x', 'slug1xxxxxxxx', 'slug1xxxxx;x', 'slug1xxxxx%x', ''])(
    'treats %j like an unknown slug in every action',
    async (slug) => {
      const app = makeApp(() => NOW)
      const link = await addLink(1)
      const cookie = await enter(app, link.slug)
      const outcomes = async (s: string) => ({
        gallery: await openGallery(db, get(`/l/${link.slug}`, cookie), s, NOW),
        enter: await enterLink(db, form(`/l/${link.slug}/enter`, { password: PASSWORD }), s, parts),
        leave: await leaveLink(db, form(`/l/${link.slug}/leave`, {}, { cookie }), s, NOW),
      })
      const wrong = await outcomes(slug)
      expect(wrong).toEqual(await outcomes(UNKNOWN))
      expect(wrong).toEqual({
        gallery: { kind: 'password' },
        enter: { kind: 'failed' },
        leave: { kind: 'refused' },
      })
      const sessions = await db.prepare('SELECT COUNT(*) AS n FROM session').first('n')
      expect(sessions).toBe(1)
    },
  )
})
