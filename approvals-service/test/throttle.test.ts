import { describe, it, expect, beforeEach } from 'vitest'
import { FAILURE } from '../src/visitor/password-page'
import { addLink, bytesOf, clearTables, clock, db, form, makeApp, PASSWORD } from './visitor-setup'

const MINUTES_15 = 15 * 60 * 1000
const WRONG = 'not the password at all'

beforeEach(clearTables)

const tries = (linkId: string) =>
  db.prepare('SELECT tries, tries_since AS since FROM link WHERE id = ?').bind(linkId).first()

describe('the wrong-password limit [approvals-service.md "Wrong-password limit"]', () => {
  it('lets the tenth try in and refuses the eleventh, even with the right password', async () => {
    const time = clock()
    const app = makeApp(time.now)
    const link = await addLink(1)
    const tryOnce = (password: string) => app.fetch(form(`/l/${link.slug}/enter`, { password }))

    for (let i = 0; i < 9; i++) expect((await tryOnce(WRONG)).status).toBe(200)
    expect(await tries(link.id)).toEqual({ tries: 9, since: time.now() })
    expect((await tryOnce(PASSWORD)).status).toBe(303)
    expect(await tries(link.id)).toEqual({ tries: 0, since: null })

    for (let i = 0; i < 10; i++) await tryOnce(WRONG)
    const refused = await tryOnce(PASSWORD)
    expect(refused.status).toBe(200)
    expect(refused.headers.has('Set-Cookie')).toBe(false)
    expect(await refused.text()).toContain(FAILURE)
    expect(await db.prepare('SELECT COUNT(*) AS n FROM session').first('n')).toBe(1)

    time.advance(MINUTES_15 - 1)
    expect((await tryOnce(PASSWORD)).status).toBe(200)
    time.advance(1)
    expect((await tryOnce(PASSWORD)).status).toBe(303)
  })

  it('counts a try in a new 15-minute window from 1', async () => {
    const time = clock()
    const app = makeApp(time.now)
    const link = await addLink(1)
    await app.fetch(form(`/l/${link.slug}/enter`, { password: WRONG }))
    time.advance(MINUTES_15)
    await app.fetch(form(`/l/${link.slug}/enter`, { password: WRONG }))
    expect(await tries(link.id)).toEqual({ tries: 1, since: time.now() })
  })

  it('gives the same bytes for a wrong password, too many tries and an unknown slug', async () => {
    const app = makeApp(clock().now)
    const link = await addLink(1)
    const tryOnce = async () =>
      bytesOf(await app.fetch(form(`/l/${link.slug}/enter`, { password: WRONG })))

    const wrong = await tryOnce()
    for (let i = 0; i < 10; i++) await tryOnce()
    const tooMany = await tryOnce()
    await db.prepare('DELETE FROM link').run()
    const unknown = await tryOnce()

    expect(wrong.status).toBe(200)
    expect(new TextDecoder().decode(wrong.body)).toContain(FAILURE)
    expect(wrong.headers.some(([name]) => name === 'set-cookie')).toBe(false)
    expect(tooMany).toEqual(wrong)
    expect(unknown).toEqual(wrong)
  })
})
