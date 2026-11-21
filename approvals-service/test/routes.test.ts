import { describe, it, expect, vi, afterEach } from 'vitest'
import { env } from 'cloudflare:workers'
import { z } from 'zod'
import { API_ROUTES, createApp } from '../src/app'
import { bodyRoute, plainRoute } from '../src/api/route'
import { apiJson } from '../src/api/errors'
import type { VisitorRoute } from '../src/visitor/routes'

const KEY = 'k'.repeat(40)
const parts = { now: () => 0, random: (n: number) => new Uint8Array(n) }
const ORIGIN = 'https://approvals.example'
const post = (path: string, body: unknown) =>
  new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

const Echo = z.strictObject({ word: z.string().trim() })
const seen: string[] = []
const echo = bodyRoute({
  name: 'echo',
  method: 'POST',
  path: /^\/api\/v1\/echo$/,
  body: Echo,
  // The check sees the parsed body and the environment, before the handler.
  check: (body, checkEnv) =>
    body.word === 'refuse' && checkEnv.API_KEY === KEY
      ? { status: 400, code: 'invalid_input' }
      : null,
  handler: async (ctx) => {
    seen.push(ctx.body.word)
    // @ts-expect-error the body is typed by the route's own schema
    seen.push(ctx.body.other)
    return apiJson({ word: ctx.body.word })
  },
})
const plain = plainRoute({
  name: 'plain',
  method: 'GET',
  path: /^\/api\/v1\/plain$/,
  handler: async (ctx) => apiJson({ body: ctx.body ?? null }),
})

const app = (tables: Parameters<typeof createApp>[2]) =>
  createApp({ DB: env.DB, API_KEY: KEY }, parts, tables)

describe('API route entries', () => {
  it('hand the handler its body as its own schema parsed it', async () => {
    const reply = await app({ api: [echo] }).fetch(post('/api/v1/echo', { word: '  hi  ' }))
    expect(await reply.json()).toEqual({ word: 'hi' })
    const none = await app({ api: [plain] }).fetch(
      new Request(`${ORIGIN}/api/v1/plain`, { headers: { Authorization: `Bearer ${KEY}` } }),
    )
    expect(await none.json()).toEqual({ body: null })
  })

  it('run the check after the schema and before the handler, with the fixed error reply', async () => {
    seen.length = 0
    const reply = await app({ api: [echo] }).fetch(post('/api/v1/echo', { word: 'refuse' }))
    expect(reply.status).toBe(400)
    expect(await reply.json()).toEqual({
      error: { code: 'invalid_input', message: 'The request does not match the contract.' },
    })
    expect(seen).toEqual([])
  })

  it.each(['replace-gallery', 'renew-pictures'])(
    '%s checks its picture addresses once it is no longer a stub (AP-2: checkPictureUrl)',
    (name) => {
      const route = API_ROUTES.find((r) => r.name === name)
      expect(route).toBeDefined()
      expect(route?.isStub === true || route?.hasCheck === true).toBe(true)
    },
  )
})

describe('the visitor router', () => {
  afterEach(() => vi.restoreAllMocks())

  it('answers a failing handler with the fixed 500 page and logs only names', async () => {
    const logged: unknown[][] = []
    vi.spyOn(console, 'error').mockImplementation((...args) => void logged.push(args))
    const failing: VisitorRoute = {
      name: 'gallery',
      method: 'GET',
      path: /^\/l\/([0-9A-Za-z]{12})$/,
      handler: async () => {
        throw new TypeError('slug aZ09aZ09aZ09 broke')
      },
    }
    const reply = await app({ visitor: [failing] }).fetch(new Request(`${ORIGIN}/l/aZ09aZ09aZ09`))
    expect(reply.status).toBe(500)
    expect(await reply.text()).toBe('Something went wrong. Try again later.')
    expect(Object.fromEntries(reply.headers)).toEqual({
      'content-type': 'text/plain; charset=utf-8',
      'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer',
      'cross-origin-opener-policy': 'same-origin',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
      'strict-transport-security': 'max-age=31536000',
    })
    expect(logged).toEqual([['gallery', 'TypeError']])
  })
})
