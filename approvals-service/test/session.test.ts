import { describe, it, expect, beforeEach } from 'vitest'
import * as sessions from '../src/db/sessions'
import {
  addLink,
  clearTables,
  clock,
  cookieOf,
  db,
  enter,
  form,
  get,
  makeApp,
} from './visitor-setup'

const HOURS_12 = 12 * 60 * 60 * 1000
const COOKIE_TEXT =
  /^__Host-adman-([0-9A-Za-z]{12})=([A-Za-z0-9_-]{43}); Path=\/; Max-Age=43200; HttpOnly; Secure; SameSite=Lax$/

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

const isGallery = (text: string) => text.includes('<h1>Campaign 1</h1>')
const isPasswordPage = (text: string) => text.includes('<h1>Review campaign</h1>')

beforeEach(clearTables)

describe('the session [approvals-service.md "Session"]', () => {
  it('sets the cookie with exactly the spec attribute text and opens the gallery', async () => {
    const time = clock()
    const app = makeApp(time.now)
    const link = await addLink(1)
    const reply = await app.fetch(
      form(`/l/${link.slug}/enter`, { password: 'correct horse battery' }),
    )
    expect(reply.status).toBe(303)
    expect(reply.headers.get('Location')).toBe(`/l/${link.slug}`)
    const text = reply.headers.get('Set-Cookie') ?? ''
    expect(text).toMatch(COOKIE_TEXT)
    expect(COOKIE_TEXT.exec(text)?.[1]).toBe(link.slug)
    expect(isGallery(await (await app.fetch(get(`/l/${link.slug}`, cookieOf(reply)))).text())).toBe(
      true,
    )
  })

  it('stores the hash of the token with the link and a 12-hour end, never the token', async () => {
    const time = clock()
    const app = makeApp(time.now)
    const link = await addLink(1)
    const token = (await enter(app, link.slug)).split('=')[1] ?? ''
    const { results } = await db.prepare('SELECT * FROM session').all()
    expect(results).toEqual([
      { token_hash: await sha256Hex(token), link_id: link.id, expires_at: time.now() + HOURS_12 },
    ])
    expect(JSON.stringify(results)).not.toContain(token)
  })

  it('gives the password page to every cookie that is not a live session of this link', async () => {
    const time = clock()
    const app = makeApp(time.now)
    const [a, b] = [await addLink(1), await addLink(2)]
    const ownCookie = await enter(app, a.slug)
    const otherCookie = await enter(app, b.slug)
    const otherToken = otherCookie.split('=')[1] ?? ''
    const ownToken = ownCookie.split('=')[1] ?? ''
    const name = `__Host-adman-${a.slug}`
    const cases: [string, string][] = [
      ['no cookie', ''],
      ["another link's cookie", otherCookie],
      ["another link's token under this name", `${name}=${otherToken}`],
      ['a token one letter short', `${name}=${ownToken.slice(1)}`],
      ['a token one letter long', `${name}=${ownToken}A`],
      ['a token with a dot', `${name}=.${ownToken.slice(1)}`],
      ['an unknown token', `${name}=${'A'.repeat(43)}`],
      ['the name with another case', `__host-adman-${a.slug}=${ownToken}`],
    ]
    for (const [label, cookie] of cases) {
      const text = await (await app.fetch(get(`/l/${a.slug}`, cookie))).text()
      expect(isPasswordPage(text), label).toBe(true)
    }
    expect(isGallery(await (await app.fetch(get(`/l/${a.slug}`, ownCookie))).text())).toBe(true)
    time.advance(HOURS_12)
    const expired = await (await app.fetch(get(`/l/${a.slug}`, ownCookie))).text()
    expect(isPasswordPage(expired), 'expired').toBe(true)
  })

  it('"Leave" deletes the session row and clears the cookie', async () => {
    const app = makeApp(clock().now)
    const [a, b] = [await addLink(1), await addLink(2)]
    const cookie = await enter(app, a.slug)
    await enter(app, b.slug)
    const reply = await app.fetch(form(`/l/${a.slug}/leave`, {}, { cookie }))
    expect(reply.status).toBe(303)
    expect(reply.headers.get('Location')).toBe(`/l/${a.slug}`)
    expect(reply.headers.get('Set-Cookie')).toBe(
      `__Host-adman-${a.slug}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    )
    const left = await db.prepare('SELECT link_id FROM session').all()
    expect(left.results).toEqual([{ link_id: b.id }])
    const after = await (await app.fetch(get(`/l/${a.slug}`, cookie))).text()
    expect(isPasswordPage(after)).toBe(true)
  })

  it("deletes this link's expired sessions on each right password, and no other", async () => {
    const time = clock()
    const app = makeApp(time.now)
    const [a, b] = [await addLink(1), await addLink(2)]
    const stale = { expiresAt: time.now() - 1 }
    await sessions.addSession(db, { tokenHash: 'old-a', linkId: a.id, ...stale }).run()
    await sessions.addSession(db, { tokenHash: 'old-b', linkId: b.id, ...stale }).run()
    await enter(app, a.slug)
    const hashes = await db.prepare('SELECT token_hash FROM session ORDER BY token_hash').all()
    expect(hashes.results.map((r) => r.token_hash)).not.toContain('old-a')
    expect(hashes.results.map((r) => r.token_hash)).toContain('old-b')
  })
})
