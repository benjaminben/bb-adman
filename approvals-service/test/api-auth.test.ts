import { describe, it, expect } from 'vitest'
import { db } from './db'
import { createApp } from '../src/app'

const KEY = 'k'.repeat(40)
const parts = { now: () => 1_700_000_000_000, random: (n: number) => new Uint8Array(n) }
const app = (apiKey: string | undefined) => createApp({ DB: db, API_KEY: apiKey }, parts)

const ORIGIN = 'https://approvals.example'
const HEALTH = `${ORIGIN}/api/v1/health`
const LINKS = `${ORIGIN}/api/v1/links`
const bearer = (key: string) => ({ Authorization: `Bearer ${key}` })
const json = { 'Content-Type': 'application/json' }

// A body larger than 4 MiB, sent as a stream so the request has no Content-Length.
function bigStream(): ReadableStream<Uint8Array> {
  let left = 4 * 1024 * 1024 + 1
  return new ReadableStream({
    pull(controller) {
      const size = Math.min(left, 64 * 1024)
      left -= size
      controller.enqueue(new Uint8Array(size).fill(32))
      if (left === 0) controller.close()
    },
  })
}

type Row = [
  name: string,
  apiKey: string | undefined,
  request: () => Request,
  status: number,
  code: string,
]

const rows: Row[] = [
  ['no Authorization header', KEY, () => new Request(HEALTH), 401, 'bad_key'],
  [
    'a wrong key',
    KEY,
    () => new Request(HEALTH, { headers: bearer('w'.repeat(40)) }),
    401,
    'bad_key',
  ],
  [
    'a key one letter off',
    KEY,
    () => new Request(HEALTH, { headers: bearer(`${'k'.repeat(39)}j`) }),
    401,
    'bad_key',
  ],
  [
    'a key with a longer tail',
    KEY,
    () => new Request(HEALTH, { headers: bearer(`${KEY}k`) }),
    401,
    'bad_key',
  ],
  [
    'a malformed header',
    KEY,
    () => new Request(HEALTH, { headers: { Authorization: `bearer ${KEY}` } }),
    401,
    'bad_key',
  ],
  [
    'the key without Bearer',
    KEY,
    () => new Request(HEALTH, { headers: { Authorization: KEY } }),
    401,
    'bad_key',
  ],
  ['no key on an unknown path', KEY, () => new Request(`${ORIGIN}/api/v1/nothing`), 401, 'bad_key'],
  [
    'API_KEY unset',
    undefined,
    () => new Request(HEALTH, { headers: bearer(KEY) }),
    503,
    'not_set_up',
  ],
  [
    'API_KEY of 31 characters',
    'k'.repeat(31),
    () => new Request(HEALTH, { headers: bearer('k'.repeat(31)) }),
    503,
    'not_set_up',
  ],
  [
    'an Origin header with the right key',
    KEY,
    () => new Request(HEALTH, { headers: { ...bearer(KEY), Origin: ORIGIN } }),
    403,
    'bad_request',
  ],
  [
    'a wrong content type',
    KEY,
    () =>
      new Request(LINKS, {
        method: 'POST',
        headers: { ...bearer(KEY), 'Content-Type': 'text/plain' },
        body: '{}',
      }),
    415,
    'bad_request',
  ],
  [
    'no content type',
    KEY,
    () => new Request(LINKS, { method: 'POST', headers: bearer(KEY), body: new Blob(['{}']) }),
    415,
    'bad_request',
  ],
  [
    'a body over 4 MiB without Content-Length',
    KEY,
    () =>
      new Request(LINKS, {
        method: 'POST',
        headers: { ...bearer(KEY), ...json },
        body: bigStream(),
        duplex: 'half',
      }),
    413,
    'too_large',
  ],
  [
    'a body that is not JSON',
    KEY,
    () =>
      new Request(LINKS, { method: 'POST', headers: { ...bearer(KEY), ...json }, body: '{nope' }),
    400,
    'invalid_input',
  ],
  [
    'a body that breaks the contract',
    KEY,
    () =>
      new Request(LINKS, {
        method: 'POST',
        headers: { ...bearer(KEY), ...json },
        body: '{"password":"<script>"}',
      }),
    400,
    'invalid_input',
  ],
  [
    'a path ID that breaks the contract',
    KEY,
    () => new Request(`${LINKS}/not-a-ulid/spring-abc234`, { headers: bearer(KEY) }),
    400,
    'invalid_input',
  ],
]

async function tableCounts(): Promise<number[]> {
  const tables = ['link', 'gallery_variant', 'signoff', 'session']
  return Promise.all(
    tables.map(
      async (t) => (await db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).first<number>('n')) ?? 0,
    ),
  )
}

describe('the keyed API order of checks [approvals-service.md "The keyed API"]', () => {
  it.each(rows)('refuses %s', async (_name, apiKey, request, status, code) => {
    const before = await tableCounts()
    const reply = await app(apiKey).fetch(request())
    expect(reply.status).toBe(status)
    const body = (await reply.json()) as { error: { code: string; message: string } }
    expect(body.error.code).toBe(code)
    expect(JSON.stringify(body)).not.toContain('<script>')
    expect(JSON.stringify(body)).not.toContain('nope')
    expect(await tableCounts()).toEqual(before)
  })

  it('answers health with the right key', async () => {
    const reply = await app(KEY).fetch(new Request(HEALTH, { headers: bearer(KEY) }))
    expect(reply.status).toBe(200)
    expect(await reply.json()).toEqual({ service: 'adman-approvals', contract: 2 })
  })

  it('sends no-store, nosniff and no CORS header on every reply', async () => {
    for (const [, apiKey, request] of rows) {
      const reply = await app(apiKey).fetch(request())
      expect(reply.headers.get('Cache-Control')).toBe('no-store')
      expect(reply.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(reply.headers.get('Content-Type')).toBe('application/json; charset=utf-8')
      expect([...reply.headers.keys()].filter((h) => h.startsWith('access-control'))).toEqual([])
    }
  })

  it('answers 404 not_found for a stub route and an unknown path, once the key is right', async () => {
    for (const url of [
      `${LINKS}/01ARZ3NDEKTSV4RRFFQ69G5FAV/spring-abc234`,
      `${ORIGIN}/api/v1/nothing`,
    ]) {
      const reply = await app(KEY).fetch(new Request(url, { headers: bearer(KEY) }))
      expect(reply.status).toBe(404)
      expect(((await reply.json()) as { error: { code: string } }).error.code).toBe('not_found')
    }
  })

  it('gives each code its one fixed sentence', async () => {
    const messages = new Map<string, Set<string>>()
    for (const [, apiKey, request] of rows) {
      const { error } = (await (await app(apiKey).fetch(request())).json()) as {
        error: { code: string; message: string }
      }
      messages.set(error.code, (messages.get(error.code) ?? new Set()).add(error.message))
    }
    for (const [code, set] of messages) expect(set.size, code).toBe(1)
  })
})
