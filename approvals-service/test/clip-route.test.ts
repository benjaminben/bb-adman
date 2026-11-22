import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { createApp } from '../src/app'
import { cryptoBytes } from '../src/crypto/random'
import { putVariant, type NewVariantRow } from '../src/db/variants'
import type { ClipRange, ClipSource } from '../src/pictures/clip-source'
import { s3ClipSource } from '../src/pictures/s3-clip-source'
import { addLink, clearTables, clock, db, enter, get } from './visitor-setup'

// round-2-approvals-video.md "The clip route (service)", SV-1, SV-3 and SV-5: every check before
// the first byte; every failure is the empty 404 and asks the source for nothing.

const MIB = 1024 * 1024
const KEY = 'abc234'
const TEST_ORIGIN = 'http://127.0.0.1:9'
const STORED = `${TEST_ORIGIN}/clips/d.mp4?X-Amz-Signature=secret`
const time = clock()

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

// A stand-in source: the bytes asked for, each a number 0 to 250, and every call it was sent.
const asked: { url: string; range: ClipRange }[] = []
const standIn: ClipSource = {
  async getPiece(ref, range) {
    asked.push({ url: ref.url, range })
    return new Uint8Array(range.end - range.start + 1).map((_, i) => (range.start + i) % 251)
  },
}

beforeEach(async () => {
  asked.length = 0
  await clearTables()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const video = (over: Partial<NewVariantRow> = {}): NewVariantRow => ({
  variantKey: KEY,
  position: 0,
  title: 'Spring',
  sizeLine: '1920 × 1080 · 0:02',
  version: 3,
  pictureUrl: `${TEST_ORIGIN}/a.png`,
  pictureExpiresAt: time.now() + 1000,
  kind: 'video',
  clipUrl: STORED,
  clipMs: 2000,
  clipBytes: 2048,
  ...over,
})

type Over = { row?: Partial<NewVariantRow>; clips?: ClipSource | null }

async function setUp(over: Over = {}) {
  const env = { DB: db, TEST_PICTURE_ORIGIN: TEST_ORIGIN }
  const clips = over.clips === null ? undefined : (over.clips ?? standIn)
  const app = createApp(env, { now: time.now, random: cryptoBytes, clips })
  const link = await addLink(1)
  await putVariant(db, link.id, video(over.row)).run()
  const cookie = await enter(app, link.slug)
  const fetchClip = (range: string | null, version = '3', headers: Record<string, string> = {}) => {
    const request = get(`/l/${link.slug}/c/${KEY}/${version}`, cookie)
    if (range !== null) request.headers.set('Range', range)
    for (const [name, value] of Object.entries(headers)) request.headers.set(name, value)
    return app.fetch(request)
  }
  return { app, link, cookie, fetchClip }
}

async function expectEmpty404(reply: Response) {
  expect(reply.status).toBe(404)
  expect(Object.fromEntries(reply.headers)).toEqual(TEXT_404)
  expect(await reply.text()).toBe('')
}

async function piecesOf(reply: Response) {
  const reader = (reply.body as ReadableStream<Uint8Array>).getReader()
  const sizes: number[] = []
  const parts: Uint8Array[] = []
  for (let next = await reader.read(); !next.done; next = await reader.read()) {
    sizes.push(next.value.byteLength)
    parts.push(next.value)
  }
  return { sizes, bytes: new Uint8Array(await new Blob(parts).arrayBuffer()) }
}

describe('GET /l/{slug}/c/{variantKey}/{version}: a piece [round-2-approvals-video.md]', () => {
  it('answers a good range with 206, the piece and exactly the clip headers', async () => {
    const { fetchClip } = await setUp()
    const reply = await fetchClip('bytes=0-1')
    expect(reply.status).toBe(206)
    expect(Object.fromEntries(reply.headers)).toEqual({
      'content-type': 'video/mp4',
      'content-range': 'bytes 0-1/2048',
      'content-length': '2',
      'accept-ranges': 'bytes',
      'x-content-type-options': 'nosniff',
      'cache-control': 'no-store',
      'content-security-policy': "default-src 'none'; sandbox",
      'cross-origin-resource-policy': 'same-origin',
      'referrer-policy': 'no-referrer',
    })
    expect((await piecesOf(reply)).bytes).toEqual(new Uint8Array([0, 1]))
    expect(asked).toEqual([{ url: STORED, range: { start: 0, end: 1, total: 2048 } }])
  })

  it('cuts an open range at 4 MiB and streams it in 1 MiB pieces', async () => {
    const { fetchClip } = await setUp({ row: { clipBytes: 10 * MIB } })
    const reply = await fetchClip(`bytes=${MIB}-`)
    expect(reply.status).toBe(206)
    expect(reply.headers.get('Content-Range')).toBe(`bytes ${MIB}-${5 * MIB - 1}/${10 * MIB}`)
    expect((await piecesOf(reply)).sizes).toEqual([MIB, MIB, MIB, MIB])
    expect(asked[0]?.range).toEqual({ start: MIB, end: 5 * MIB - 1, total: 10 * MIB })
  })

  it.each([
    ['a start at the total', 'bytes=2048-'],
    ['an end before the start', 'bytes=9-5'],
  ])('answers %s with 416 and the clip size, asking for nothing', async (_, range) => {
    const { fetchClip } = await setUp()
    const reply = await fetchClip(range)
    expect(reply.status).toBe(416)
    expect(Object.fromEntries(reply.headers)).toEqual({
      ...TEXT_404,
      'content-range': 'bytes */2048',
    })
    expect(await reply.text()).toBe('')
    expect(asked).toEqual([])
  })
})

describe('the clip route refuses before any byte [SV-1]', () => {
  it('answers no cookie with the empty 404, even for a range past the end', async () => {
    const { app, link } = await setUp()
    for (const range of ['bytes=0-1', 'bytes=9999-']) {
      const request = get(`/l/${link.slug}/c/${KEY}/3`)
      request.headers.set('Range', range)
      await expectEmpty404(await app.fetch(request))
    }
    expect(asked).toEqual([])
  })

  it("answers another link's cookie and another link's variant with the empty 404", async () => {
    const { app, cookie, link } = await setUp()
    const other = await addLink(2)
    await putVariant(db, other.id, video({ variantKey: 'zzz234' })).run()
    const token = cookie.split('=')[1] ?? ''
    const moved = `__Host-adman-${other.slug}=${token}`
    const tries = [
      get(`/l/${other.slug}/c/zzz234/3`, moved),
      get(`/l/${other.slug}/c/zzz234/3`, cookie),
      get(`/l/${link.slug}/c/zzz234/3`, cookie),
    ]
    for (const request of tries) {
      request.headers.set('Range', 'bytes=0-1')
      await expectEmpty404(await app.fetch(request))
    }
    expect(asked).toEqual([])
  })

  it.each([
    ['an older version', '2'],
    ['a newer version', '4'],
    ['the version with a leading zero', '03'],
  ])('answers %s with the empty 404', async (_, version) => {
    const { fetchClip } = await setUp()
    await expectEmpty404(await fetchClip('bytes=0-1', version))
    expect(asked).toEqual([])
  })

  const rows: [string, Over][] = [
    ['an image row', { row: { kind: 'image', clipUrl: null, clipMs: null, clipBytes: null } }],
    ['a video sent as its still only', { row: { clipUrl: null, clipMs: null, clipBytes: null } }],
    ['a row whose time has passed', { row: { pictureExpiresAt: time.now() - 1 } }],
    ['a row whose time is now', { row: { pictureExpiresAt: time.now() } }],
    ['no clips part', { clips: null }],
  ]
  it.each(rows)('answers %s with the empty 404, even for a range past the end', async (_, over) => {
    const { fetchClip } = await setUp(over)
    await expectEmpty404(await fetchClip('bytes=0-1'))
    await expectEmpty404(await fetchClip('bytes=9999-'))
    expect(asked).toEqual([])
  })

  it.each([
    ['no Range header', null],
    ['several ranges', 'bytes=0-1, 5-9'],
    ['a suffix range', 'bytes=-500'],
  ])('answers %s with the empty 404', async (_, range) => {
    const { fetchClip } = await setUp()
    await expectEmpty404(await fetchClip(range))
    expect(asked).toEqual([])
  })

  it('answers a source that finds nothing with the empty 404', async () => {
    const { fetchClip } = await setUp({ clips: { getPiece: async () => null } })
    await expectEmpty404(await fetchClip('bytes=0-1'))
  })

  it('answers HEAD with the plain 404', async () => {
    const { app, link, cookie } = await setUp()
    const request = new Request(get(`/l/${link.slug}/c/${KEY}/3`, cookie), { method: 'HEAD' })
    const reply = await app.fetch(request)
    expect(reply.status).toBe(404)
    expect(asked).toEqual([])
  })
})

describe('the clip address stays secret [SV-5]', () => {
  it('answers a throwing source with the empty 404 and logs nothing', async () => {
    const logs = (['error', 'warn', 'log', 'info'] as const).map((name) =>
      vi.spyOn(console, name).mockImplementation(() => undefined),
    )
    const clips: ClipSource = {
      getPiece: async () => {
        throw new Error(STORED)
      },
    }
    const { fetchClip } = await setUp({ clips })
    const reply = await fetchClip('bytes=0-1')
    expect([...reply.headers].join('\n')).not.toContain('127.0.0.1')
    await expectEmpty404(reply)
    for (const spy of logs) expect(spy).not.toHaveBeenCalled()
  })
})

describe('the clip route passes nothing of the visitor on [SV-3]', () => {
  const calls: RequestInit[] = []
  beforeEach(() => {
    calls.length = 0
    vi.stubGlobal('fetch', async (_: unknown, init: RequestInit) => {
      calls.push(init)
      const bytes = new Uint8Array([0, 0])
      const headers = { 'Content-Range': 'bytes 0-1/2048', 'Content-Length': '2' }
      return new Response(bytes, { status: 206, headers })
    })
  })

  it("sends only the route's own Range, whatever the visitor's request holds", async () => {
    const { fetchClip } = await setUp({
      clips: s3ClipSource({ DB: db, TEST_PICTURE_ORIGIN: TEST_ORIGIN }),
    })
    const visitor = { Authorization: 'Bearer visitor', Referer: 'https://approvals.example/l/x' }
    const reply = await fetchClip('bytes=0-1', '3', visitor)
    expect(reply.status).toBe(206)
    await reply.arrayBuffer()
    expect(calls).toEqual([{ redirect: 'manual', headers: { Range: 'bytes=0-1' } }])
    const refused = await fetchClip('bytes=0-1, 5-9', '3', visitor)
    await expectEmpty404(refused)
    expect(calls).toHaveLength(1)
  })
})
