import { describe, it, expect, beforeEach } from 'vitest'
import { addSignoff } from '../src/db/signoffs'
import { putVariant, type VariantRow } from '../src/db/variants'
import { addLink, clearTables, clock, db, enter, form, makeApp } from './visitor-setup'

// spec/approvals-service-visitor.md "Forms that write": Sign off and Remove (AP-4).

const KEY = 'abc234'
const EMAIL = 'ann@example.com'

const variant = (version = 1, variantKey = KEY): VariantRow => ({
  variantKey,
  position: 0,
  title: 'Spring',
  sizeLine: '1080 × 1080',
  version,
  pictureUrl: 'https://bucket.s3.eu-west-1.amazonaws.com/p.png',
  pictureExpiresAt: Date.UTC(2030, 0, 1),
})

async function rows() {
  const sql = `SELECT link_id AS linkId, variant_key AS variantKey, version, email, created_at
    AS createdAt FROM signoff ORDER BY created_at, id`
  return (await db.prepare(sql).all()).results
}

async function setUp() {
  const time = clock()
  const app = makeApp(time.now)
  const link = await addLink(1)
  await putVariant(db, link.id, variant()).run()
  const cookie = await enter(app, link.slug)
  const signOff = (fields: Record<string, string>) =>
    app.fetch(form(`/l/${link.slug}/signoffs`, fields, { cookie }))
  const remove = (id: string) =>
    app.fetch(form(`/l/${link.slug}/signoffs/${id}/remove`, {}, { cookie }))
  return { app, link, cookie, time, signOff, remove }
}

const fields = (over: Record<string, string> = {}) => ({
  variant: KEY,
  version: '1',
  email: EMAIL,
  ...over,
})

beforeEach(clearTables)

describe('POST /l/{slug}/signoffs [approvals-service-visitor.md "Forms that write"]', () => {
  it('writes one sign-off for the session link and goes back to the variant with m=signed', async () => {
    const { link, time, signOff } = await setUp()
    const reply = await signOff(fields({ email: '  Ann@Example.COM ' }))
    expect(reply.status).toBe(303)
    expect(reply.headers.get('Location')).toBe(`/l/${link.slug}?m=signed#v-${KEY}`)
    expect(reply.headers.has('Set-Cookie')).toBe(false)
    expect(await rows()).toEqual([
      { linkId: link.id, variantKey: KEY, version: 1, email: EMAIL, createdAt: time.now() },
    ])
    const id = await db.prepare('SELECT id FROM signoff').first('id')
    expect(id).toMatch(/^[0-9A-Za-z]{24}$/)
  })

  it('adds nothing on a repeat, and still answers m=signed', async () => {
    const { link, signOff } = await setUp()
    await signOff(fields())
    const reply = await signOff(fields({ email: 'ANN@example.com' }))
    expect(reply.headers.get('Location')).toBe(`/l/${link.slug}?m=signed#v-${KEY}`)
    expect(await rows()).toHaveLength(1)
  })

  it.each([
    ['an old version', async () => fields({ version: '0' })],
    ['a newer version than stored', async () => fields({ version: '2' })],
    [
      'a variant removed between page and post',
      async (linkId: string) => {
        await db.prepare('DELETE FROM gallery_variant WHERE link_id = ?').bind(linkId).run()
        return fields()
      },
    ],
    ['a variant that never existed', async () => fields({ variant: 'zzzzzz' })],
  ])('writes nothing for %s and answers m=changed', async (_, make) => {
    const { link, signOff } = await setUp()
    const sent = await make(link.id)
    const reply = await signOff(sent)
    expect(reply.status).toBe(303)
    expect(reply.headers.get('Location')).toBe(`/l/${link.slug}?m=changed#v-${sent.variant}`)
    expect(await rows()).toEqual([])
  })

  it('writes nothing for a variant key that only another link has', async () => {
    const { link, signOff } = await setUp()
    const other = await addLink(2)
    await putVariant(db, other.id, variant(1, 'xyz789')).run()
    const reply = await signOff(fields({ variant: 'xyz789' }))
    expect(reply.headers.get('Location')).toBe(`/l/${link.slug}?m=changed#v-xyz789`)
    expect(await rows()).toEqual([])
  })

  it.each([
    '',
    'ann',
    'ann@',
    'ann@example',
    'ann@exämple.com',
    'a b@example.com',
    'x'.repeat(255),
  ])('writes nothing for the email %j and answers m=bad-email', async (email) => {
    const { link, signOff } = await setUp()
    const reply = await signOff(fields({ email }))
    expect(reply.headers.get('Location')).toBe(`/l/${link.slug}?m=bad-email#v-${KEY}`)
    expect(await rows()).toEqual([])
  })

  it('writes nothing when the email field is missing', async () => {
    const { link, signOff } = await setUp()
    const reply = await signOff({ variant: KEY, version: '1' })
    expect(reply.headers.get('Location')).toBe(`/l/${link.slug}?m=bad-email#v-${KEY}`)
    expect(await rows()).toEqual([])
  })

  it.each([
    ['a version that is not a whole number', { version: '1.0' }, `#v-${KEY}`],
    ['a negative version', { version: '-1' }, `#v-${KEY}`],
    ['an empty version', { version: '' }, `#v-${KEY}`],
    ['a version past the safe range', { version: '9007199254740992' }, `#v-${KEY}`],
    ['a variant of the wrong shape', { variant: 'ABC234' }, ''],
    ['a variant that would leave the anchor', { variant: 'abc234#x' }, ''],
  ])('writes nothing for %s and answers m=changed', async (_, over, anchor) => {
    const { link, signOff } = await setUp()
    const reply = await signOff(fields(over))
    expect(reply.status).toBe(303)
    expect(reply.headers.get('Location')).toBe(`/l/${link.slug}?m=changed${anchor}`)
    expect(await rows()).toEqual([])
  })

  it("refuses the session of another link's slug with 403, writing nothing", async () => {
    const { app, cookie } = await setUp()
    const other = await addLink(2)
    await putVariant(db, other.id, variant()).run()
    const reply = await app.fetch(form(`/l/${other.slug}/signoffs`, fields(), { cookie }))
    expect(reply.status).toBe(403)
    expect(await rows()).toEqual([])
  })
})

describe('POST /l/{slug}/signoffs/{id}/remove [approvals-service-visitor.md "Forms that write"]', () => {
  const row = { variantKey: KEY, version: 1, email: EMAIL, createdAt: 1 }

  it('removes a sign-off of this link and goes back to its variant with m=removed', async () => {
    const { link, remove } = await setUp()
    await addSignoff(db, link.id, { id: 'A'.repeat(24), ...row }).run()
    const reply = await remove('A'.repeat(24))
    expect(reply.status).toBe(303)
    expect(reply.headers.get('Location')).toBe(`/l/${link.slug}?m=removed#v-${KEY}`)
    expect(await rows()).toEqual([])
  })

  it("removes nothing for another link's sign-off, and still answers m=removed", async () => {
    const { link, remove } = await setUp()
    const other = await addLink(2)
    await addSignoff(db, other.id, { id: 'B'.repeat(24), ...row }).run()
    const reply = await remove('B'.repeat(24))
    expect(reply.status).toBe(303)
    expect(reply.headers.get('Location')).toBe(`/l/${link.slug}?m=removed`)
    expect(await rows()).toHaveLength(1)
  })

  it('answers m=removed for an ID that is not there', async () => {
    const { link, remove } = await setUp()
    const reply = await remove('C'.repeat(24))
    expect(reply.headers.get('Location')).toBe(`/l/${link.slug}?m=removed`)
  })

  it("refuses the session of another link's slug with 403, removing nothing", async () => {
    const { app, cookie } = await setUp()
    const other = await addLink(2)
    await addSignoff(db, other.id, { id: 'D'.repeat(24), ...row }).run()
    const path = `/l/${other.slug}/signoffs/${'D'.repeat(24)}/remove`
    const reply = await app.fetch(form(path, {}, { cookie }))
    expect(reply.status).toBe(403)
    expect(await rows()).toHaveLength(1)
  })
})
