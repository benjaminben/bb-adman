import { describe, it, expect, beforeEach } from 'vitest'
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

// A body of `size` bytes holding the right password, so a form that got through would write.
const padded = (size: number) => {
  const start = `password=${encodeURIComponent(PASSWORD)}&pad=`
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

// What each route would write: a session row (enter adds, leave removes) and the try count.
async function written() {
  const sessions = await db.prepare('SELECT COUNT(*) AS n FROM session').first('n')
  const tries = await db.prepare('SELECT tries, tries_since FROM link').all()
  return { sessions, tries: tries.results }
}

describe('forms that write [approvals-service.md "Forms that write"]', () => {
  for (const [label, options, routes] of ROWS) {
    for (const route of routes) {
      it(`refuses ${label} on /${route} with 403, writing nothing`, async () => {
        const app = makeApp(clock().now)
        const link = await addLink(1)
        const cookie = await enter(app, link.slug)
        const before = await written()
        const path = `/l/${link.slug}/${route}`
        const request =
          options === 'stream'
            ? streamed(path, cookie, KIB_8 + 1)
            : form(path, { password: PASSWORD }, { cookie, ...options })
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
