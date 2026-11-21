import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:workers'
import { createApp } from '../src/app'
import { cryptoBytes } from '../src/crypto/random'
import { hashPassword } from '../src/crypto/password'
import { deleteLink, setLinkPassword } from '../src/db/links'
import { deleteLinkSessions } from '../src/db/sessions'
import { startSession } from '../src/visitor/session'
import { tryPassword } from '../src/visitor/throttle'
import { FAILURE } from '../src/visitor/password-page'
import { addLink, clearTables, clock, db, enter, form, get, PASSWORD } from './visitor-setup'

const KEY = 'k'.repeat(40)
const PROJECT = '01ARZ3NDEKTSV4RRFFQ69G5FAV'

const sessionRows = async () => (await db.prepare('SELECT * FROM session').all()).results

// What the API does on a new password and on a delete (src/api/links.ts), done directly.
const CHANGES = {
  'a password change': async (linkId: string) => {
    const next = await hashPassword('a brand new password', 1000)
    await db.batch([setLinkPassword(db, linkId, next), deleteLinkSessions(db, linkId)])
  },
  'a link deletion': (linkId: string) => deleteLink(db, linkId),
}

// A database whose next batch first runs `before`: the change lands after the hash check and
// before the session insert, the gap a real race would use.
function racingDb(before: () => Promise<unknown>): D1Database {
  let armed = true
  return new Proxy(db, {
    get(target, prop) {
      if (prop === 'batch') {
        return async (statements: D1PreparedStatement[]) => {
          if (armed) {
            armed = false
            await before()
          }
          return target.batch(statements)
        }
      }
      const value = Reflect.get(target, prop) as unknown
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

beforeEach(clearTables)

describe('a session is never made for a password or link that changed meanwhile', () => {
  for (const [label, change] of Object.entries(CHANGES)) {
    it(`makes no session after ${label} between the check and the insert`, async () => {
      const time = clock()
      const link = await addLink(1)
      const checked = await tryPassword(db, link.slug, PASSWORD, time.now())
      expect(checked).not.toBeNull()
      await change(link.id)
      const parts = { now: time.now, random: cryptoBytes }
      expect(await startSession(db, checked!, link.slug, parts)).toBeNull()
      expect(await sessionRows()).toEqual([])
    })

    it(`answers /enter with the failure page and no cookie after ${label} mid-check`, async () => {
      const time = clock()
      const link = await addLink(1)
      const raced = racingDb(() => change(link.id))
      const app = createApp({ DB: raced }, { now: time.now, random: cryptoBytes })
      const reply = await app.fetch(form(`/l/${link.slug}/enter`, { password: PASSWORD }))
      expect(reply.status).toBe(200)
      expect(reply.headers.has('Set-Cookie')).toBe(false)
      expect(await reply.text()).toContain(FAILURE)
      expect(await sessionRows()).toEqual([])
    })
  }
})

describe('the API ends sessions [approvals-service.md "Session"]', () => {
  const app = createApp({ DB: env.DB, API_KEY: KEY }, { now: clock().now, random: cryptoBytes })
  const call = (method: string, path: string, body?: unknown) =>
    new Request(`https://approvals.example/api/v1/links/${PROJECT}/campaign-1-abc234${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${KEY}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  const requests: [string, () => Request][] = [
    ['a new password', () => call('PUT', '/password', { password: 'a brand new password' })],
    ['a link deletion', () => call('DELETE', '')],
  ]

  for (const [label, request] of requests) {
    it(`gives the old cookie the password page after ${label}`, async () => {
      const link = await addLink(1)
      const cookie = await enter(app, link.slug)
      const before = await (await app.fetch(get(`/l/${link.slug}`, cookie))).text()
      expect(before).toContain('<h1>Campaign 1</h1>')
      expect((await app.fetch(request())).status).toBe(200)
      const after = await (await app.fetch(get(`/l/${link.slug}`, cookie))).text()
      expect(after).toContain('<h1>Review campaign</h1>')
      expect(after).not.toContain('Campaign 1')
    })
  }
})
