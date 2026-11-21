import { describe, it, expect, beforeEach } from 'vitest'
import { addSignoff } from '../src/db/signoffs'
import { putVariant } from '../src/db/variants'
import {
  addLink,
  clearTables,
  clock,
  db,
  enter,
  form,
  makeApp,
  ORIGIN,
  PASSWORD,
  type FormOptions,
} from './visitor-setup'

const REFUSED = 'This form could not be sent. Open the link again and try once more.'
const KIB_8 = 8 * 1024

// The fields of every route's form, so a form that got through would write on any of them.
const FIELDS = { password: PASSWORD, variant: 'abc234', version: '1', email: 'ann@example.com' }

// A body of `size` bytes holding the right password, so a form that got through would write.
const padded = (size: number) => {
  const start = `${new URLSearchParams(FIELDS).toString()}&pad=`
  return start + 'x'.repeat(size - start.length)
}

// Sent as a stream, so there is no Content-Length to trust.
function streamed(path: string, cookie: string, size: number) {
  const bytes = new TextEncoder().encode(padded(size))
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      Origin: ORIGIN,
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie,
    },
    body,
    duplex: 'half',
  })
}

type Row = [string, FormOptions | 'stream', ('enter' | 'leave')[]]

const ROWS: Row[] = [
  ['no Origin', { headers: { Origin: '' } }, ['enter', 'leave']],
  ['another Origin', { headers: { Origin: 'https://evil.example' } }, ['enter', 'leave']],
  ['the Origin over http', { headers: { Origin: 'http://approvals.example' } }, ['enter', 'leave']],
  ['Origin "null"', { headers: { Origin: 'null' } }, ['enter', 'leave']],
  [
    'Sec-Fetch-Site: cross-site',
    { headers: { 'Sec-Fetch-Site': 'cross-site' } },
    ['enter', 'leave'],
  ],
  ['Sec-Fetch-Site: same-site', { headers: { 'Sec-Fetch-Site': 'same-site' } }, ['enter', 'leave']],
  ['a JSON content type', { headers: { 'Content-Type': 'application/json' } }, ['enter', 'leave']],
  [
    'a multipart content type',
    { headers: { 'Content-Type': 'multipart/form-data' } },
    ['enter', 'leave'],
  ],
  ['no content type', { headers: { 'Content-Type': '' } }, ['enter', 'leave']],
  ['a 9 KiB body', { body: padded(9 * 1024) }, ['enter', 'leave']],
  ['an 8 KiB + 1 body', { body: padded(KIB_8 + 1) }, ['enter', 'leave']],
  ['an 8 KiB + 1 body with no Content-Length', 'stream', ['enter', 'leave']],
  ['no session', { cookie: '' }, ['leave']],
]

beforeEach(clearTables)

// What each route would write: a session row (enter adds, leave removes), the try count and the
// sign-offs (sign off adds, remove removes).
async function written() {
  const sessions = await db.prepare('SELECT COUNT(*) AS n FROM session').first('n')
  const tries = await db.prepare('SELECT tries, tries_since FROM link').all()
  const signoffs = await db.prepare('SELECT id FROM signoff ORDER BY id').all()
  return { sessions, tries: tries.results, signoffs: signoffs.results }
}

// AP-4: the two sign-off routes need a session, so they take every row that /leave takes.
type Route = 'enter' | 'leave' | 'signoffs' | 'remove'
const SIGNOFF_ID = 'A'.repeat(24)
const pathOf = (route: Route) => (route === 'remove' ? `signoffs/${SIGNOFF_ID}/remove` : route)
const routesOf = (routes: Row[2]): Route[] =>
  routes.includes('leave') ? [...routes, 'signoffs', 'remove'] : routes

async function addGallery(linkId: string) {
  const variant = { variantKey: FIELDS.variant, position: 0, title: 'T', sizeLine: 'S' }
  const picture = { pictureUrl: 'https://b.s3.x.amazonaws.com/p', pictureExpiresAt: 9e12 }
  await putVariant(db, linkId, { ...variant, version: 1, ...picture }).run()
  const row = { variantKey: FIELDS.variant, version: 1, email: 'bo@example.com', createdAt: 1 }
  await addSignoff(db, linkId, { id: SIGNOFF_ID, ...row }).run()
}

describe('forms that write [approvals-service.md "Forms that write"]', () => {
  for (const [label, options, rowRoutes] of ROWS) {
    for (const route of routesOf(rowRoutes)) {
      it(`refuses ${label} on /${route} with 403, writing nothing`, async () => {
        const app = makeApp(clock().now)
        const link = await addLink(1)
        await addGallery(link.id)
        const cookie = await enter(app, link.slug)
        const before = await written()
        const path = `/l/${link.slug}/${pathOf(route)}`
        const request =
          options === 'stream'
            ? streamed(path, cookie, KIB_8 + 1)
            : form(path, FIELDS, { cookie, ...options })
        if (options !== 'stream' && options.headers?.Origin === '') request.headers.delete('Origin')
        if (options !== 'stream' && options.headers?.['Content-Type'] === '') {
          request.headers.delete('Content-Type')
        }
        const reply = await app.fetch(request)
        expect(reply.status).toBe(403)
        expect(reply.headers.has('Set-Cookie')).toBe(false)
        expect(await reply.text()).toContain(REFUSED)
        expect(await written()).toEqual(before)
      })
    }
  }

  it('lets through a form of exactly 8 KiB, with no Sec-Fetch-Site, and a charset', async () => {
    const app = makeApp(clock().now)
    const link = await addLink(1)
    const request = form(
      `/l/${link.slug}/enter`,
      {},
      {
        body: padded(KIB_8),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      },
    )
    request.headers.delete('Sec-Fetch-Site')
    expect((await app.fetch(request)).status).toBe(303)
  })
})
