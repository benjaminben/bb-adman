import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { createApp } from '../src/app'
import { cryptoBytes } from '../src/crypto/random'
import type { Db } from '../src/db/client'
import { addSignoff } from '../src/db/signoffs'
import { putVariant, type VariantRow } from '../src/db/variants'
import { openGallery } from '../src/visitor/actions'
import { reviewerCookie } from '../src/visitor/reviewer'
import { galleryStamp } from '../src/visitor/stamp'
import { addLink, clearTables, clock, db, enter, form } from './visitor-setup'

// spec/phases/round-2-approvals.md "Routes and data changes", "Sign off all: one request for all"
// and the security rules S-5, S-6 and S-7 (R2A-3).

const EMAIL = 'ann@example.com'
const HOUR = 60 * 60 * 1000

// What a test can make the stand-in database do: fail on a statement or a batch, or run a
// gallery change just before the batch.
type Trap = {
  failOn?: (sql: string) => boolean
  failBatch?: boolean
  beforeBatch?: () => Promise<void>
}

// The test database behind a stand-in that can fail or interfere, and counts each batch's size.
function standIn(trap: Trap) {
  const batches: number[] = []
  const wrapped: Db = {
    prepare(sql) {
      if (trap.failOn?.(sql) === true) throw new Error(`failed for ${EMAIL}`)
      return db.prepare(sql)
    },
    async batch(statements) {
      batches.push(statements.length)
      if (trap.failBatch === true) throw new Error(`failed for ${EMAIL}`)
      await trap.beforeBatch?.()
      return db.batch(statements)
    },
  }
  return { wrapped, batches }
}

const variant = (variantKey: string, version: number, position: number, expiresAt: number) =>
  ({
    variantKey,
    position,
    title: `Title ${variantKey}`,
    sizeLine: '1080 × 1080',
    version,
    pictureUrl: 'https://bucket.s3.eu-west-1.amazonaws.com/p.png',
    pictureExpiresAt: expiresAt,
  }) satisfies VariantRow

async function rows() {
  const sql = `SELECT link_id AS linkId, variant_key AS variantKey, version, email
    FROM signoff ORDER BY variant_key`
  return (await db.prepare(sql).all()).results
}

// Link 1: two live variants and one expired. Link 2: a live variant of its own.
async function setUp() {
  const time = clock()
  const now = time.now()
  const trap: Trap = {}
  const { wrapped, batches } = standIn(trap)
  const app = createApp({ DB: wrapped }, { now: time.now, random: cryptoBytes })
  const link = await addLink(1)
  const other = await addLink(2)
  await putVariant(db, link.id, variant('aaa234', 1, 0, now + HOUR)).run()
  await putVariant(db, link.id, variant('bbb234', 2, 1, now + HOUR)).run()
  await putVariant(db, link.id, variant('ccc234', 1, 2, now - 1)).run()
  await putVariant(db, other.id, variant('ddd234', 1, 0, now + HOUR)).run()
  const cookie = await enter(app, link.slug)
  // The stamp exactly as the page draws it.
  const view = await openGallery(db, { slug: link.slug, cookie, m: null }, now)
  if (view.kind !== 'gallery') throw new Error('no gallery')
  const seen = view.view.stamp
  batches.length = 0
  const post = (fields: Record<string, string>, path = 'signoffs') =>
    app.fetch(form(`/l/${link.slug}/${path}`, fields, { cookie }))
  return { app, link, other, time, trap, batches, seen, post, cookie }
}

const own = (linkId: string) => [
  { linkId, variantKey: 'aaa234', version: 1, email: EMAIL },
  { linkId, variantKey: 'bbb234', version: 2, email: EMAIL },
]

beforeEach(clearTables)

describe('Sign off all [R2A-3, S-7]', () => {
  it('signs every live variant of this link at its current version, in one batch', async () => {
    const { link, batches, seen, post } = await setUp()
    const reply = await post({ email: '  Ann@Example.COM ', all: '1', seen })
    expect(reply.status).toBe(303)
    expect(reply.headers.get('Location')).toBe(`/l/${link.slug}?m=signed-all`)
    expect(reply.headers.getSetCookie()).toEqual([reviewerCookie(link.slug, EMAIL)])
    expect(batches).toEqual([2])
    expect(await rows()).toEqual(own(link.id))
    const ids = await db.prepare('SELECT id FROM signoff').all<{ id: string }>()
    expect(ids.results.map((row) => row.id)).toEqual([
      expect.stringMatching(/^[0-9A-Za-z]{24}$/),
      expect.stringMatching(/^[0-9A-Za-z]{24}$/),
    ])
  })

  it('adds nothing for a variant this email already signed, or on a repeat', async () => {
    const { link, seen, post } = await setUp()
    const row = { id: 'A'.repeat(24), variantKey: 'aaa234', version: 1, email: EMAIL }
    await addSignoff(db, link.id, { ...row, createdAt: 1 }).run()
    await post({ email: EMAIL, all: '1', seen })
    const reply = await post({ email: EMAIL, all: '1', seen })
    expect(reply.headers.get('Location')).toBe(`/l/${link.slug}?m=signed-all`)
    expect(await rows()).toEqual(own(link.id))
  })

  it('writes no row for a variant changed between the stamp check and the batch', async () => {
    const { link, time, trap, seen, post } = await setUp()
    trap.beforeBatch = () =>
      putVariant(db, link.id, variant('bbb234', 3, 1, time.now() + HOUR))
        .run()
        .then(() => undefined)
    const reply = await post({ email: EMAIL, all: '1', seen })
    expect(reply.headers.get('Location')).toBe(`/l/${link.slug}?m=signed-all`)
    expect(await rows()).toEqual([
      { linkId: link.id, variantKey: 'aaa234', version: 1, email: EMAIL },
    ])
  })

  const STALE: [string, (seen: string) => Record<string, string>][] = [
    ['no seen', () => ({})],
    ['an empty seen', () => ({ seen: '' })],
    ['a seen in upper case', (seen) => ({ seen: seen.toUpperCase() })],
    ['a seen one letter short', (seen) => ({ seen: seen.slice(1) })],
    ['a seen with more after it', (seen) => ({ seen: `${seen}0` })],
    [
      'the stamp of another set',
      () => ({ seen: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
    ],
  ]

  it.each(STALE)('writes nothing for %s and answers gallery-changed', async (_, make) => {
    const { link, batches, seen, post } = await setUp()
    const reply = await post({ email: EMAIL, all: '1', ...make(seen) })
    expect(reply.status).toBe(303)
    expect(reply.headers.get('Location')).toBe(`/l/${link.slug}?m=gallery-changed`)
    expect(batches).toEqual([])
    expect(await rows()).toEqual([])
  })

  it('writes nothing when the gallery was replaced after the page was drawn', async () => {
    const { link, time, seen, post } = await setUp()
    await putVariant(db, link.id, variant('bbb234', 3, 1, time.now() + HOUR)).run()
    const reply = await post({ email: EMAIL, all: '1', seen })
    expect(reply.headers.get('Location')).toBe(`/l/${link.slug}?m=gallery-changed`)
    expect(await rows()).toEqual([])
  })

  it('writes nothing when a picture expired after the page was drawn', async () => {
    const { link, time, seen, post } = await setUp()
    time.advance(HOUR)
    const reply = await post({ email: EMAIL, all: '1', seen })
    expect(reply.headers.get('Location')).toBe(`/l/${link.slug}?m=gallery-changed`)
    expect(await rows()).toEqual([])
  })

  it("never signs another link's variants, even with that link's stamp", async () => {
    const { link, other, seen, post } = await setUp()
    const theirs = await galleryStamp([{ variantKey: 'ddd234', version: 1 }])
    await post({ email: EMAIL, all: '1', seen: theirs })
    await post({ email: EMAIL, all: '1', seen })
    expect(await rows()).toEqual(own(link.id))
    expect((await rows()).some((row) => row.linkId === other.id)).toBe(false)
  })

  it('writes nothing and sets no cookie for a bad email, going back with no anchor', async () => {
    const { link, seen, post } = await setUp()
    const reply = await post({ email: 'ann@', all: '1', seen })
    expect(reply.headers.get('Location')).toBe(`/l/${link.slug}?m=bad-email`)
    expect(reply.headers.has('Set-Cookie')).toBe(false)
    expect(await rows()).toEqual([])
  })

  it.each([
    ['neither one nor all', () => ({})],
    ['both one and all', (seen: string) => ({ one: 'aaa234.1', all: '1', seen })],
    ['all of another value', (seen: string) => ({ all: 'yes', seen })],
    ['the old variant and version fields', () => ({ variant: 'aaa234', version: '1' })],
  ])('writes nothing for %s and answers changed', async (_, make) => {
    const { link, batches, seen, post } = await setUp()
    const reply = await post({ email: EMAIL, ...make(seen) })
    expect(reply.headers.get('Location')).toBe(`/l/${link.slug}?m=changed`)
    expect(batches).toEqual([])
    expect(await rows()).toEqual([])
  })
})

// "Routes and data changes": POST /signoffs sets the reviewer cookie whenever the email passes,
// whatever the result; never for a bad email or a refused form.
describe('the reviewer cookie on a sign-off post [R2A-3, S-1, S-2]', () => {
  const GOOD: [string, (seen: string) => Record<string, string>][] = [
    ['one, signed', () => ({ one: 'aaa234.1' })],
    ['one, changed', () => ({ one: 'aaa234.9' })],
    ['one, malformed', () => ({ one: 'nonsense' })],
    ['all, signed', (seen) => ({ all: '1', seen })],
    ['all, gallery changed', () => ({ all: '1', seen: '' })],
    ['neither', () => ({})],
    ['both', (seen) => ({ one: 'aaa234.1', all: '1', seen })],
  ]

  it.each(GOOD)('sets it for a good email: %s', async (_, make) => {
    const { link, seen, post } = await setUp()
    const reply = await post({ email: ' Ann@Example.com', ...make(seen) })
    expect(reply.status).toBe(303)
    expect(reply.headers.getSetCookie()).toEqual([reviewerCookie(link.slug, EMAIL)])
  })

  it.each(GOOD)('never sets it for a bad email: %s', async (_, make) => {
    const { seen, post } = await setUp()
    for (const email of [null, '', 'ann@', '<script>@example.com']) {
      const fields = { ...make(seen), ...(email === null ? {} : { email }) }
      const reply = await post(fields)
      expect(reply.headers.get('Location')).toMatch(/\?m=bad-email$/)
      expect(reply.headers.has('Set-Cookie')).toBe(false)
    }
    expect(await rows()).toEqual([])
  })

  it.each(GOOD)('never sets it on a refused form: %s', async (_, make) => {
    const { app, link, seen, cookie } = await setUp()
    const fields = { email: EMAIL, ...make(seen) }
    const path = `/l/${link.slug}/signoffs`
    const refusals = [
      form(path, fields, { cookie, headers: { Origin: 'https://evil.example' } }),
      form(path, fields, { cookie, headers: { 'Sec-Fetch-Site': 'cross-site' } }),
      form(path, fields, { cookie, headers: { 'Content-Type': 'application/json' } }),
      form(path, fields, { cookie, body: `email=${EMAIL}&pad=${'x'.repeat(9 * 1024)}` }),
      form(path, fields, { cookie: '' }),
    ]
    for (const request of refusals) {
      const reply = await app.fetch(request)
      expect(reply.status).toBe(403)
      expect(reply.headers.has('Set-Cookie')).toBe(false)
    }
    expect(await rows()).toEqual([])
  })
})

describe('no email in an address or a log line [S-5, S-6]', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('puts no email in the address of any reply of the visitor routes', async () => {
    const { link, seen, post } = await setUp()
    const at = new RegExp(`^/l/${link.slug}(\\?m=[a-z-]+)?(#v-[2-9a-z]{6})?$`)
    const replies = [
      await post({ email: EMAIL, one: 'aaa234.1' }),
      await post({ email: EMAIL, one: 'aaa234.9' }),
      await post({ email: EMAIL, one: 'ann@example.com' }),
      await post({ email: 'ann@', one: 'aaa234.1' }),
      await post({ email: EMAIL, all: '1', seen }),
      await post({ email: EMAIL, all: '1', seen: EMAIL }),
      await post({ email: 'ann@', all: '1', seen }),
      await post({ email: EMAIL }),
      await post({ email: EMAIL }, `signoffs/${'B'.repeat(24)}/remove`),
      await post({ email: EMAIL }, 'reviewer'),
      await post({ email: 'ann@' }, 'reviewer'),
      await post({ email: EMAIL }, 'leave'),
    ]
    for (const reply of replies) {
      expect(reply.status).toBe(303)
      const location = reply.headers.get('Location') ?? ''
      expect(location).toMatch(at)
      expect(location).not.toContain('ann')
    }
  })

  const FAILURES: [string, Trap, Record<string, string>][] = [
    ['one, writing', { failOn: (sql) => sql.includes('INTO signoff') }, { one: 'aaa234.1' }],
    ['all, reading the set', { failOn: (sql) => sql.includes('ORDER BY position') }, { all: '1' }],
    ['all, the batch', { failBatch: true }, { all: '1' }],
  ]

  it.each(FAILURES)(
    'logs only the route name and the error name for %s',
    async (_, set, fields) => {
      const { trap, seen, post } = await setUp()
      Object.assign(trap, set)
      const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const reply = await post({ email: EMAIL, seen, ...fields })
      expect(reply.status).toBe(500)
      expect(spy.mock.calls).toEqual([['sign-off', 'Error']])
      expect(await reply.text()).not.toContain('ann')
      expect(reply.headers.has('Location')).toBe(false)
    },
  )
})
