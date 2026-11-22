import { beforeEach, describe, expect, it } from 'vitest'
import { openGallery } from '../src/visitor/actions'
import { clearedReviewerCookie, reviewerCookie, reviewerOf } from '../src/visitor/reviewer'
import { addLink, clearTables, db, enter, form, makeApp, PASSWORD } from './visitor-setup'

// spec/phases/round-2-approvals.md "How the email is kept and checked (R-11)": S-2, S-3, S-5,
// S-9 of "Security rules and the test that proves each".
const SLUG = 'aZ09aZ09aZ09'
const OTHER = 'bY18bY18bY18'
const NOW = Date.UTC(2026, 10, 21, 12, 0)
const ATTRIBUTES = 'Path=/; HttpOnly; Secure; SameSite=Lax'
// S-5: every 303 goes back to the link's page, with at most a notice key and a variant anchor.
const location = (slug: string) => new RegExp(`^/l/${slug}(\\?m=[a-z-]+)?(#v-[2-9a-z]{6})?$`)

beforeEach(clearTables)

describe('the reviewer cookie text [S-2]', () => {
  it('is exactly the name, the email and the session-only attributes', () => {
    expect(reviewerCookie(SLUG, 'ann@example.com')).toBe(
      `__Host-adman-${SLUG}-as=ann@example.com; ${ATTRIBUTES}`,
    )
  })

  it('has no Max-Age, Expires or Domain, so the browser drops it when its session ends', () => {
    const text = reviewerCookie(SLUG, 'ann@example.com').toLowerCase()
    for (const part of ['max-age', 'expires', 'domain']) expect(text).not.toContain(part)
  })

  it('is cleared with the same attributes and Max-Age=0', () => {
    expect(clearedReviewerCookie(SLUG)).toBe(
      `__Host-adman-${SLUG}-as=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    )
  })
})

describe('reviewerOf reads only a checked email under exactly this name [S-3]', () => {
  const name = `__Host-adman-${SLUG}-as`
  const ROWS: [string, string | null, string | null][] = [
    ['a good email', `${name}=ann@example.com`, 'ann@example.com'],
    ['a good email among others', `a=b; ${name}=ann@example.com; c=d`, 'ann@example.com'],
    ['upper case', `${name}=Ann@Example.com`, null],
    ['a space before', `${name}= ann@example.com`, null],
    ['a space inside', `${name}=ann @example.com`, null],
    ['a script', `${name}=<script>alert(1)</script>`, null],
    ['300 letters', `${name}=${'a'.repeat(288)}@example.com`, null],
    ['quotes', `${name}="ann@example.com"`, null],
    ['no at sign', `${name}=ann.example.com`, null],
    ['an empty value', `${name}=`, null],
    ["another link's name", `__Host-adman-${OTHER}-as=ann@example.com`, null],
    ['the session name', `__Host-adman-${SLUG}=ann@example.com`, null],
    ['the name in another case', `__host-adman-${SLUG}-as=ann@example.com`, null],
    ['the name with a prefix', `x${name}=ann@example.com`, null],
    ['no cookie', '', null],
    ['no header', null, null],
  ]

  it.each(ROWS)('gives %s as %j', (_label, cookie, expected) => {
    expect(reviewerOf(cookie, SLUG)).toBe(expected)
  })
})

async function setUp() {
  const app = makeApp(() => NOW)
  const link = await addLink(1, 'Secret Campaign')
  const session = await enter(app, link.slug)
  const save = (email: string | null, cookie = session) =>
    app.fetch(form(`/l/${link.slug}/reviewer`, email === null ? {} : { email }, { cookie }))
  return { app, link, session, save }
}

const counts = async () => ({
  sessions: await db.prepare('SELECT COUNT(*) AS n FROM session').first('n'),
  signoffs: await db.prepare('SELECT COUNT(*) AS n FROM signoff').first('n'),
})

describe('POST /l/{slug}/reviewer [S-2, S-5]', () => {
  it('sets the reviewer cookie for a good email and goes back with email-saved', async () => {
    const { link, save } = await setUp()
    const before = await counts()
    const reply = await save('  Ann.Lee@Example.COM ')
    expect(reply.status).toBe(303)
    expect(reply.headers.get('Location')).toBe(`/l/${link.slug}?m=email-saved`)
    expect(reply.headers.getSetCookie()).toEqual([reviewerCookie(link.slug, 'ann.lee@example.com')])
    expect(await reply.text()).toBe('')
    expect(await counts()).toEqual(before)
  })

  it.each([
    ['no field', null],
    ['an empty field', ''],
    ['no at sign', 'ann.example.com'],
    ['a script', '<script>@example.com'],
    ['300 letters', `${'a'.repeat(288)}@example.com`],
  ])('sets no cookie for %s and goes back with bad-email', async (_label, email) => {
    const { link, save } = await setUp()
    const reply = await save(email)
    expect(reply.status).toBe(303)
    expect(reply.headers.get('Location')).toBe(`/l/${link.slug}?m=bad-email`)
    expect(reply.headers.has('Set-Cookie')).toBe(false)
  })

  it('refuses a post with no session: 403 and no cookie', async () => {
    const { save } = await setUp()
    const reply = await save('ann@example.com', '')
    expect(reply.status).toBe(403)
    expect(reply.headers.has('Set-Cookie')).toBe(false)
  })

  it('puts no email in any address it answers with', async () => {
    const { link, save, app, session } = await setUp()
    const replies = [
      await save('ann@example.com'),
      await save('Ann@Example.com'),
      await save('ann@'),
      await save(null),
      await app.fetch(form(`/l/${link.slug}/leave`, {}, { cookie: session })),
    ]
    for (const reply of replies) {
      const at = reply.headers.get('Location') ?? ''
      expect(at).toMatch(location(link.slug))
      expect(at.toLowerCase()).not.toContain('ann')
    }
  })
})

describe('the view reads the reviewer cookie only with a session [S-3, S-9]', () => {
  it('gives the checked email to the view next to the session', async () => {
    const { link, session } = await setUp()
    const cookie = `${session}; ${reviewerCookie(link.slug, 'ann@example.com').split(';')[0]}`
    const result = await openGallery(db, { slug: link.slug, cookie, m: null }, NOW)
    if (result.kind !== 'gallery') throw new Error('no gallery')
    expect(result.view.reviewer).toBe('ann@example.com')
  })

  it('gives null for no reviewer cookie and for a bad one', async () => {
    const { link, session } = await setUp()
    for (const extra of ['', `; __Host-adman-${link.slug}-as=Ann@Example.com`]) {
      const result = await openGallery(
        db,
        { slug: link.slug, cookie: session + extra, m: null },
        NOW,
      )
      if (result.kind !== 'gallery') throw new Error('no gallery')
      expect(result.view.reviewer).toBeNull()
    }
  })

  it("does not read another link's reviewer cookie", async () => {
    const { link, session } = await setUp()
    const other = await addLink(2)
    const cookie = `${session}; __Host-adman-${other.slug}-as=ann@example.com`
    const result = await openGallery(db, { slug: link.slug, cookie, m: null }, NOW)
    if (result.kind !== 'gallery') throw new Error('no gallery')
    expect(result.view.reviewer).toBeNull()
  })

  it('gives the password page for the reviewer cookie alone', async () => {
    const { link } = await setUp()
    const cookie = `__Host-adman-${link.slug}-as=ann@example.com`
    const result = await openGallery(db, { slug: link.slug, cookie, m: null }, NOW)
    expect(result).toEqual({ kind: 'password', notice: null })
  })
})

describe('"Log out" clears both cookies [S-9]', () => {
  it('ends the session row and clears the session cookie, then the reviewer cookie', async () => {
    const { app, link, session, save } = await setUp()
    const reviewer = (await save('ann@example.com')).headers.getSetCookie()[0]?.split(';')[0]
    const both = `${session}; ${reviewer}`
    const reply = await app.fetch(form(`/l/${link.slug}/leave`, {}, { cookie: both }))
    expect(reply.status).toBe(303)
    expect(reply.headers.get('Location')).toBe(`/l/${link.slug}`)
    expect(reply.headers.getSetCookie()).toEqual([
      `__Host-adman-${link.slug}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
      clearedReviewerCookie(link.slug),
    ])
    expect(await counts()).toEqual({ sessions: 0, signoffs: 0 })
    const after = await openGallery(db, { slug: link.slug, cookie: both, m: null }, NOW)
    expect(after).toEqual({ kind: 'password', notice: null })
    const again = await save('ann@example.com', both)
    expect(again.status).toBe(403)
    expect(again.headers.has('Set-Cookie')).toBe(false)
  })
})

describe('entering the password clears the saved email [verify list 10]', () => {
  it('sets the session cookie, then clears the reviewer cookie', async () => {
    const { app, link } = await setUp()
    const planted = `__Host-adman-${link.slug}-as=ann@example.com`
    const reply = await app.fetch(
      form(`/l/${link.slug}/enter`, { password: PASSWORD }, { cookie: planted }),
    )
    expect(reply.status).toBe(303)
    expect(reply.headers.get('Location')).toBe(`/l/${link.slug}`)
    const set = reply.headers.getSetCookie()
    expect(set).toHaveLength(2)
    expect(set[0]).toMatch(new RegExp(`^__Host-adman-${link.slug}=[A-Za-z0-9_-]{43}; `))
    expect(set[1]).toBe(clearedReviewerCookie(link.slug))
  })

  it('sets no cookie at all for a wrong password', async () => {
    const { app, link } = await setUp()
    const planted = `__Host-adman-${link.slug}-as=ann@example.com`
    const reply = await app.fetch(
      form(`/l/${link.slug}/enter`, { password: 'not-it' }, { cookie: planted }),
    )
    expect(reply.status).toBe(303)
    expect(reply.headers.has('Set-Cookie')).toBe(false)
  })
})
