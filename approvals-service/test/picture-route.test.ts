import { createServer, type IncomingHttpHeaders, type Server } from 'node:http'
import { afterAll, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest'
import { createApp } from '../src/app'
import { cryptoBytes } from '../src/crypto/random'
import { putVariant } from '../src/db/variants'
import { sniff } from '../src/pictures/sniff'
import type { PictureSource } from '../src/pictures/source'
import { addLink, clearTables, clock, db, enter, get } from './visitor-setup'

// spec/approvals-service-visitor.md "Pictures": the route's checks, then s3-source against a
// local Node server standing in for S3 (nothing leaves this machine).

const MIB = 1024 * 1024
const PNG_START = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const picture = (start: number[], size: number) => {
  const bytes = new Uint8Array(size).map((_, i) => i % 251)
  bytes.set(start)
  return bytes
}
const PNG = picture(PNG_START, 2 * MIB + 5)
const JPEG = picture([0xff, 0xd8, 0xff, 0xe0], 300)

// What the stand-in server answers for each path, and every request it was sent.
const seen: { path: string; headers: IncomingHttpHeaders }[] = []
let server: Server
let origin = ''

const ROUTES: Record<string, (send: (status: number, body?: Uint8Array) => void) => void> = {
  '/a.png': (send) => send(200, PNG),
  '/a.jpg': (send) => send(200, JPEG),
  '/exact.png': (send) => send(200, picture(PNG_START, 16 * MIB)),
  '/redirect': (send) => send(302),
  '/forbidden': (send) => send(403, PNG),
  '/created': (send) => send(201, PNG),
  '/big.png': (send) => send(200, picture(PNG_START, 16 * MIB + 1)),
  '/html': (send) => send(200, new TextEncoder().encode('<html><script>x</script></html>')),
  '/empty': (send) => send(200, new Uint8Array(0)),
}

beforeAll(async () => {
  server = createServer((request, reply) => {
    const path = request.url ?? ''
    seen.push({ path, headers: request.headers })
    if (path === '/chunked.png') {
      // 17 MiB with no Content-Length: only the cap while reading stops it.
      reply.writeHead(200, { 'Content-Type': 'image/png' })
      for (let i = 0; i < 17; i++) reply.write(picture(PNG_START, MIB))
      reply.end()
      return
    }
    const route = ROUTES[path]
    if (route === undefined) return void reply.writeHead(404).end()
    route((status, body) => {
      // The reply's own type is ignored: every one says text/html.
      const headers = { 'Content-Type': 'text/html', Location: `${origin}/a.png` }
      reply.writeHead(status, headers).end(body)
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  origin = `http://127.0.0.1:${typeof address === 'object' && address !== null ? address.port : 0}`
})

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

beforeEach(async () => {
  seen.length = 0
  await clearTables()
})

const KEY = 'abc234'
const time = clock()

type Over = { version?: number; expiresAt?: number; source?: PictureSource }

// Without `source`, the app's own default: s3-source.
async function setUp(path = '/a.png', over: Over = {}) {
  const env = { DB: db, TEST_PICTURE_ORIGIN: origin }
  const app = createApp(env, { now: time.now, random: cryptoBytes, pictures: over.source })
  const link = await addLink(1)
  await putVariant(db, link.id, {
    variantKey: KEY,
    position: 0,
    title: 'Spring',
    sizeLine: '1080 × 1080',
    version: over.version ?? 3,
    pictureUrl: path.startsWith('/') ? `${origin}${path}` : path,
    pictureExpiresAt: over.expiresAt ?? time.now() + 1000,
  }).run()
  const cookie = await enter(app, link.slug)
  const fetchPicture = (version = '3', headers: Record<string, string> = {}) => {
    const request = get(`/l/${link.slug}/p/${KEY}/${version}`, cookie)
    for (const [name, value] of Object.entries(headers)) request.headers.set(name, value)
    return app.fetch(request)
  }
  return { app, link, cookie, fetchPicture }
}

const TEXT_404 = {
  'content-type': 'text/plain; charset=utf-8',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'same-origin',
  'cross-origin-opener-policy': 'same-origin',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow',
  'strict-transport-security': 'max-age=31536000',
}

async function expectEmpty404(reply: Response) {
  expect(reply.status).toBe(404)
  expect(Object.fromEntries(reply.headers)).toEqual(TEXT_404)
  expect(await reply.text()).toBe('')
}

describe('sniff [approvals-service-visitor.md "Pictures"]', () => {
  it.each([
    ['a PNG', PNG_START, 'image/png'],
    ['a JPEG', [0xff, 0xd8, 0xff], 'image/jpeg'],
    ['a PNG start cut short', PNG_START.slice(0, 7), null],
    ['a JPEG start cut short', [0xff, 0xd8], null],
    ['a GIF', [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], null],
    ['HTML', [...new TextEncoder().encode('<svg ')], null],
    ['nothing', [], null],
  ])('takes %s as %s', (_, bytes, type) => {
    expect(sniff(new Uint8Array(bytes))).toBe(type)
  })
})

describe('GET /l/{slug}/p/{variantKey}/{version}: the route [approvals-service-visitor.md "Pictures"]', () => {
  it('passes a PNG on as a stream in 1 MiB pieces, with exactly the picture headers', async () => {
    const { fetchPicture } = await setUp()
    const reply = await fetchPicture()
    expect(reply.status).toBe(200)
    expect(Object.fromEntries(reply.headers)).toEqual({
      'content-type': 'image/png',
      'x-content-type-options': 'nosniff',
      'cache-control': 'no-store',
      'content-security-policy': "default-src 'none'; sandbox",
      'cross-origin-resource-policy': 'same-origin',
      'referrer-policy': 'no-referrer',
    })
    const reader = (reply.body as ReadableStream<Uint8Array>).getReader()
    const pieces: number[] = []
    const parts: Uint8Array[] = []
    for (let next = await reader.read(); !next.done; next = await reader.read()) {
      pieces.push(next.value.byteLength)
      parts.push(next.value)
    }
    expect(pieces).toEqual([MIB, MIB, 5])
    expect(new Uint8Array(await new Blob(parts).arrayBuffer())).toEqual(PNG)
  })

  it.each([
    ['a JPEG', '/a.jpg', 'image/jpeg'],
    ['a PNG of exactly 16 MiB', '/exact.png', 'image/png'],
  ])('passes %s, its type from the sniff only', async (_, path, type) => {
    const { fetchPicture } = await setUp(path)
    const reply = await fetchPicture()
    expect(reply.status).toBe(200)
    expect(reply.headers.get('Content-Type')).toBe(type)
    await reply.arrayBuffer()
  })

  it('answers no session with the empty 404, fetching nothing', async () => {
    const { link, app } = await setUp()
    await expectEmpty404(await app.fetch(get(`/l/${link.slug}/p/${KEY}/3`)))
    expect(seen).toEqual([])
  })

  it('answers the session of another link with the empty 404, fetching nothing', async () => {
    const { app, cookie } = await setUp()
    const other = await addLink(2)
    await putVariant(db, other.id, {
      variantKey: KEY,
      position: 0,
      title: 'Other',
      sizeLine: 'S',
      version: 3,
      pictureUrl: `${origin}/a.png`,
      pictureExpiresAt: time.now() + 1000,
    }).run()
    const token = cookie.split('=')[1] ?? ''
    const moved = `__Host-adman-${other.slug}=${token}`
    await expectEmpty404(await app.fetch(get(`/l/${other.slug}/p/${KEY}/3`, moved)))
    await expectEmpty404(await app.fetch(get(`/l/${other.slug}/p/${KEY}/3`, cookie)))
    expect(seen).toEqual([])
  })

  it.each([
    ['an older version', '2'],
    ['a newer version', '4'],
    ['the version with a leading zero', '03'],
  ])('answers %s with the empty 404, fetching nothing', async (_, version) => {
    const { fetchPicture } = await setUp()
    await expectEmpty404(await fetchPicture(version))
    expect(seen).toEqual([])
  })

  it.each([
    ['has passed', -1],
    ['is now', 0],
  ])('answers a picture whose time %s with the empty 404, fetching nothing', async (_, by) => {
    const { fetchPicture } = await setUp('/a.png', { expiresAt: time.now() + by })
    await expectEmpty404(await fetchPicture())
    expect(seen).toEqual([])
  })

  it('answers a variant the link does not have with the empty 404', async () => {
    const { app, link, cookie } = await setUp()
    await expectEmpty404(await app.fetch(get(`/l/${link.slug}/p/zzzzzz/3`, cookie)))
  })

  it('answers a source that throws with the empty 404 and logs nothing', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const source: PictureSource = {
      get: async () => {
        throw new Error(`${origin}/a.png`)
      },
    }
    const { fetchPicture } = await setUp('/a.png', { source })
    await expectEmpty404(await fetchPicture())
    expect(log).not.toHaveBeenCalled()
    log.mockRestore()
  })
})

describe('s3-source against a local server [approvals-service-visitor.md "Pictures"]', () => {
  it.each([
    ['a 302, which is not followed', '/redirect'],
    ['a 403', '/forbidden'],
    ['a 201', '/created'],
    ['a 404', '/missing'],
    ['17 MiB with its Content-Length', '/big.png'],
    ['17 MiB with no Content-Length', '/chunked.png'],
    ['HTML bytes said to be a picture', '/html'],
    ['an empty body', '/empty'],
  ])('answers %s with the empty 404', async (_, path) => {
    const { fetchPicture } = await setUp(path)
    await expectEmpty404(await fetchPicture())
    expect(seen.map((request) => request.path)).toEqual([path])
  })

  it.each([
    ['an address the check refuses', 'https://evil.example/a.png'],
    ['the test origin on another port', 'http://127.0.0.1:1/a.png'],
    ['an address with user info', 'http://user:pw@127.0.0.1:1/a.png'],
    ['text that is not an address', 'not an address'],
  ])('fetches nothing for %s, planted in the table', async (_, address) => {
    const { fetchPicture } = await setUp(address)
    await expectEmpty404(await fetchPicture())
    expect(seen).toEqual([])
  })

  it('sends no visitor header on, and adds none of its own', async () => {
    const { fetchPicture } = await setUp()
    const reply = await fetchPicture('3', {
      Authorization: 'Bearer visitor',
      Referer: 'https://approvals.example/l/x',
      Origin: 'https://approvals.example',
      'User-Agent': 'visitor-agent',
      'X-Visitor': 'yes',
    })
    expect(reply.status).toBe(200)
    await reply.arrayBuffer()
    expect(seen).toHaveLength(1)
    const sent = seen[0]?.headers ?? {}
    for (const name of ['cookie', 'authorization', 'referer', 'origin', 'x-visitor']) {
      expect(sent[name], name).toBeUndefined()
    }
    expect(sent['user-agent']).not.toBe('visitor-agent')
    // Only the headers Node's fetch sends on its own.
    const DEFAULTS = ['host', 'connection', 'accept', 'accept-language', 'sec-fetch-mode']
    const own = [...DEFAULTS, 'user-agent', 'accept-encoding']
    expect(Object.keys(sent).filter((name) => !own.includes(name))).toEqual([])
  })

  it('never puts the stored address in a reply or a log line', async () => {
    const logs = (['error', 'warn', 'log', 'info'] as const).map((name) =>
      vi.spyOn(console, name).mockImplementation(() => undefined),
    )
    for (const path of ['http://127.0.0.1:1/a.png', '/redirect', '/big.png', '/html']) {
      await clearTables()
      const { fetchPicture } = await setUp(path)
      const reply = await fetchPicture()
      expect([...reply.headers].join('\n')).not.toContain('127.0.0.1')
      expect(await reply.text()).toBe('')
    }
    for (const spy of logs) expect(spy).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})
