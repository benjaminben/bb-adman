// The link API never reaches past the link its path names, and never stores a picture address
// in any form but the cleaned one.
import { describe, it, expect, beforeEach } from 'vitest'
import { addSession } from '../src/db/sessions'
import * as h from './api-helpers'

const { app, call, linkPath, picture, create, variant, putGallery, signoff, errorCode } = h

const A = 'spring-abc234'
const B = 'autumn-abc234'
const TABLES = ['link', 'gallery_variant', 'signoff', 'session']
const TIME = '2026-12-08T00:00:00.000Z'

// Link A: variants aaa234 and bbb234, a sign-off on bbb234. Link B: bbb234 at version 5, with
// a sign-off. A session each.
async function seed() {
  await create(A)
  await create(B)
  await putGallery(A, [variant('aaa234'), variant('bbb234')])
  await putGallery(B, [variant('bbb234', 5)])
  const [a, b] = [await h.linkIdOf(A), await h.linkIdOf(B)]
  await signoff(a, 1, 'bbb234', 1)
  await signoff(b, 2, 'bbb234', 5)
  for (const id of [a, b]) {
    await addSession(h.db, { tokenHash: `t-${id}`, linkId: id, expiresAt: h.NOW * 2 }).run()
  }
  return { a, b }
}

const all = async (table: string) =>
  (await h.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results

async function rowsOf(linkId: string) {
  return Promise.all(
    TABLES.map(async (t) => {
      const column = t === 'link' ? 'id' : 'link_id'
      const sql = `SELECT * FROM ${t} WHERE ${column} = ? ORDER BY rowid`
      return (await h.db.prepare(sql).bind(linkId).all()).results
    }),
  )
}

const renewal = (variantKey: string, version: number, pictureUrl = picture('new')) => ({
  pictures: [{ variantKey, version, pictureUrl, pictureExpiresAt: TIME }],
})
const gallery = (pictureUrl: string) => ({
  campaignName: 'Hacked',
  variants: [{ ...variant('aaa234'), pictureUrl }],
})
const other = linkPath('winter-abc234')
const own = linkPath(A)
const bad = 'https://evil.example/a.png'

beforeEach(h.clearAll)

describe('refused requests [approvals-service.md "The keyed API"]', () => {
  const rows: [string, () => Request, number, string][] = [
    ['read', () => call('GET', other), 404, 'not_found'],
    [
      'password',
      () => call('PUT', `${other}/password`, { password: h.PASSWORD }),
      404,
      'not_found',
    ],
    ['gallery', () => call('PUT', `${other}/gallery`, gallery(picture('n'))), 404, 'not_found'],
    ['pictures', () => call('PUT', `${other}/pictures`, renewal('aaa234', 1)), 404, 'not_found'],
    ['delete', () => call('DELETE', other), 404, 'not_found'],
    [
      'a bad gallery address',
      () => call('PUT', `${own}/gallery`, gallery(bad)),
      400,
      'invalid_input',
    ],
    [
      'a bad renewal address',
      () => call('PUT', `${own}/pictures`, renewal('aaa234', 1, bad)),
      400,
      'invalid_input',
    ],
  ]

  it.each(rows)('%s is refused and changes no table', async (_name, request, status, code) => {
    await seed()
    const before = await Promise.all(TABLES.map(all))
    const reply = await app().fetch(request())
    expect(reply.status).toBe(status)
    expect(await errorCode(reply)).toBe(code)
    expect(await Promise.all(TABLES.map(all))).toEqual(before)
  })
})

describe('a write to link A leaves link B alone', () => {
  it("replacing A's gallery removes A's unlisted sign-offs and keeps B's gallery and sign-offs", async () => {
    const { a, b } = await seed()
    const before = await rowsOf(b)
    const reply = await putGallery(A, [variant('ccc234')])
    expect(reply.status).toBe(200)
    expect(await rowsOf(b)).toEqual(before)
    expect(await h.countFor('signoff', a)).toBe(0)
    expect(await h.countFor('gallery_variant', a)).toBe(1)
  })

  it("a renewal on A's path naming B's variant and version renews nothing", async () => {
    await seed()
    const before = await Promise.all(TABLES.map(all))
    const reply = await app().fetch(call('PUT', `${own}/pictures`, renewal('bbb234', 5)))
    expect(reply.status).toBe(200)
    expect(await reply.json()).toEqual({ renewed: 0 })
    expect(await Promise.all(TABLES.map(all))).toEqual(before)
  })
})

describe('picture addresses are stored cleaned [approvals-service.md "Pictures"]', () => {
  const host = 'bucket.s3.us-east-1.amazonaws.com'
  const clean = `https://${host}/a.png`

  it.each([
    ['the backslash form', `https:\\\\${host}\\a.png`],
    ['spaces round it', `  ${clean}  `],
  ])('%s is stored as the plain address, by gallery replace and by renewal', async (_n, url) => {
    await create(A)
    const stored = () =>
      h.db.prepare('SELECT picture_url FROM gallery_variant').first('picture_url')
    expect((await putGallery(A, [{ ...variant('aaa234'), pictureUrl: url }])).status).toBe(200)
    expect(await stored()).toBe(clean)
    await putGallery(A, [variant('aaa234')])
    const reply = await app().fetch(call('PUT', `${own}/pictures`, renewal('aaa234', 1, url)))
    expect(await reply.json()).toEqual({ renewed: 1 })
    expect(await stored()).toBe(clean)
  })
})
