import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { s3ClipSource } from '../src/pictures/s3-clip-source'
import { db } from './db'

// round-2-approvals-video.md "The clip route (service)", `ClipSource`, SV-3 and SV-4: a stand-in
// fetch records each request and answers as told. Nothing leaves this machine.

const STORED = 'https://bucket-1.s3.eu-west-1.amazonaws.com/clips/a.mp4?X-Amz-Signature=abc'
const TOTAL = 1000
const clip = new Uint8Array(TOTAL).map((_, i) => i % 251)
clip.set(new TextEncoder().encode('ftyp'), 4)

type Answer = { status?: number; headers?: Record<string, string>; body?: BodyInit | null }
const calls: { url: unknown; init: unknown }[] = []
let answer: (start: number, end: number) => Answer

beforeEach(() => {
  calls.length = 0
  answer = (start, end) => ({
    status: 206,
    headers: {
      'Content-Range': `bytes ${start}-${end}/${TOTAL}`,
      'Content-Length': String(end - start + 1),
    },
    body: clip.slice(start, end + 1),
  })
  vi.stubGlobal('fetch', async (url: unknown, init: RequestInit) => {
    calls.push({ url, init })
    const range = /^bytes=(\d+)-(\d+)$/.exec(String(new Headers(init.headers).get('Range')))
    const { status, headers, body } = answer(Number(range?.[1]), Number(range?.[2]))
    return new Response(body ?? null, { status: status ?? 206, headers })
  })
})

afterEach(() => vi.unstubAllGlobals())

const source = s3ClipSource({ DB: db })
const piece = (start: number, end: number, url = STORED) =>
  source.getPiece({ url }, { start, end, total: TOTAL })

// A body that never ends, and how many times it was read.
function endless() {
  let pulls = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1
      controller.enqueue(new Uint8Array(64))
    },
  })
  return { stream, pulls: () => pulls }
}

describe('s3ClipSource: what it asks for [SV-3]', () => {
  it('fetches the checked address with only a Range header and no redirect followed', async () => {
    expect(await piece(0, 9)).toEqual(clip.slice(0, 10))
    expect(calls).toHaveLength(1)
    const [{ url, init }] = calls as [{ url: URL; init: RequestInit }]
    expect(url).toBeInstanceOf(URL)
    expect(url.href).toBe(STORED)
    expect(init).toEqual({ redirect: 'manual', headers: { Range: 'bytes=0-9' } })
  })

  it.each([
    ['a 302', 302],
    ['a 301', 301],
    ['a 307', 307],
  ])('fails on %s, whatever its Location', async (_, status) => {
    answer = () => ({ status, headers: { Location: STORED } })
    expect(await piece(0, 9)).toBeNull()
    expect(calls).toHaveLength(1)
  })

  it.each([
    ['an http address', 'http://bucket-1.s3.eu-west-1.amazonaws.com/a.mp4'],
    ['a host that is not S3', 'https://evil.example/a.mp4'],
    ['an address with user info', 'https://u:p@bucket-1.s3.eu-west-1.amazonaws.com/a.mp4'],
    ['text that is not an address', 'not an address'],
  ])('fetches nothing for %s, planted in the table', async (_, url) => {
    expect(await piece(0, 9, url)).toBeNull()
    expect(calls).toEqual([])
  })

  it('swallows a thrown error that names the address into null', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error(STORED)
    })
    expect(await piece(0, 9)).toBeNull()
  })
})

describe('s3ClipSource: the bytes must be exactly what was asked [SV-4]', () => {
  it.each([
    ['a piece not from 0, which is not sniffed', 500, 999],
    ['a piece from 0 shorter than 8 bytes', 0, 1],
    ['a piece with no Content-Length', 100, 199, true],
  ])('passes %s', async (_, start, end, noLength = false) => {
    const plain = answer
    answer = (s, e) => {
      const given = plain(s, e)
      if (noLength) delete given.headers?.['Content-Length']
      return given
    }
    expect(await piece(start, end)).toEqual(clip.slice(start, end + 1))
  })

  const cases: [string, (start: number, end: number) => Answer][] = [
    ['a 200 with the whole file', () => ({ status: 200, body: clip })],
    ['a 403', () => ({ status: 403 })],
    ['a 206 with no Content-Range', (s, e) => ({ body: clip.slice(s, e + 1) })],
    [
      'a wrong total',
      (s, e) => ({
        headers: { 'Content-Range': `bytes ${s}-${e}/${TOTAL + 1}` },
        body: clip.slice(s, e + 1),
      }),
    ],
    [
      'another range',
      (s, e) => ({
        headers: { 'Content-Range': `bytes ${s + 1}-${e + 1}/${TOTAL}` },
        body: clip.slice(s + 1, e + 2),
      }),
    ],
    [
      'a Content-Range with more text',
      (s, e) => ({
        headers: { 'Content-Range': `bytes ${s}-${e}/${TOTAL}, x` },
        body: clip.slice(s, e + 1),
      }),
    ],
    [
      'a wrong Content-Length',
      (s, e) => ({
        headers: { 'Content-Range': `bytes ${s}-${e}/${TOTAL}`, 'Content-Length': '5' },
        body: clip.slice(s, e + 1),
      }),
    ],
    [
      'a short body',
      (s, e) => ({
        headers: { 'Content-Range': `bytes ${s}-${e}/${TOTAL}` },
        body: clip.slice(s, e),
      }),
    ],
    [
      'a long body',
      (s, e) => ({
        headers: { 'Content-Range': `bytes ${s}-${e}/${TOTAL}` },
        body: clip.slice(s, e + 2),
      }),
    ],
    [
      'no ftyp at bytes 4 to 7',
      (s, e) => ({
        headers: { 'Content-Range': `bytes ${s}-${e}/${TOTAL}` },
        body: new Uint8Array(e - s + 1),
      }),
    ],
    ['no body', (s, e) => ({ headers: { 'Content-Range': `bytes ${s}-${e}/${TOTAL}` } })],
  ]
  it.each(cases)('fails on %s', async (_, given) => {
    answer = given
    expect(await piece(0, 99)).toBeNull()
  })

  it('stops reading a body that runs past the piece', async () => {
    const body = endless()
    answer = (s, e) => ({
      headers: { 'Content-Range': `bytes ${s}-${e}/${TOTAL}` },
      body: body.stream,
    })
    expect(await piece(0, 99)).toBeNull()
    expect(body.pulls()).toBeLessThan(10)
  })

  it('reads none of a 200 with the whole file', async () => {
    const body = endless()
    answer = () => ({ status: 200, body: body.stream })
    expect(await piece(0, 99)).toBeNull()
    expect(body.pulls()).toBeLessThan(3)
  })
})
