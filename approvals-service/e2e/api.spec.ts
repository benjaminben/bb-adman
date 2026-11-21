import { expect, test, type APIResponse } from '@playwright/test'

// spec/approvals-service.md "Tests" (AP-14): the keyed API and the catch-all through `next start`.
// The key is the random one playwright.config.ts made for this run.
const KEY = process.env.E2E_API_KEY ?? ''
const auth = { Authorization: `Bearer ${KEY}` }

// Headers any HTTP server may add; anything else must be one the router itself sets.
// `content-encoding` is `next start`'s gzip of a reply body (Vercel compresses too); it carries no
// link data. It is not in the spec's named list: reported to the architect (AP-14).
const ALLOWED = [
  'date',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-length',
  'vary',
  'content-encoding',
]

function extraHeaders(reply: APIResponse, own: string[]): string[] {
  return Object.keys(reply.headers()).filter((name) => ![...own, ...ALLOWED].includes(name))
}

const API_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
}

const TEXT_HEADERS = {
  'content-type': 'text/plain; charset=utf-8',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'cross-origin-opener-policy': 'same-origin',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow',
}

test('health answers with the key, with exactly the API headers', async ({ request }) => {
  const reply = await request.get('/api/v1/health', { headers: auth })
  expect(reply.status()).toBe(200)
  expect(await reply.json()).toEqual({ service: 'adman-approvals', contract: 1 })
  expect(reply.headers()).toMatchObject(API_HEADERS)
  expect(extraHeaders(reply, Object.keys(API_HEADERS))).toEqual([])
})

test('health without the key answers 401 bad_key', async ({ request }) => {
  const reply = await request.get('/api/v1/health')
  expect(reply.status()).toBe(401)
  expect(((await reply.json()) as { error: { code: string } }).error.code).toBe('bad_key')
  expect(extraHeaders(reply, Object.keys(API_HEADERS))).toEqual([])
})

test('a trailing slash is answered by the router, not redirected', async ({ request }) => {
  const reply = await request.get('/api/v1/health/', { headers: auth, maxRedirects: 0 })
  expect(reply.status()).toBe(404)
  expect(((await reply.json()) as { error: { code: string } }).error.code).toBe('not_found')
})

test('robots.txt has exactly the plain text headers', async ({ request }) => {
  const reply = await request.get('/robots.txt')
  expect(await reply.text()).toBe('User-agent: *\nDisallow: /\n')
  expect(reply.headers()).toMatchObject(TEXT_HEADERS)
  expect(extraHeaders(reply, Object.keys(TEXT_HEADERS))).toEqual([])
})

for (const method of ['OPTIONS', 'HEAD', 'PATCH'] as const) {
  test(`${method} on the API reaches the router's key check`, async ({ request }) => {
    const reply = await request.fetch('/api/v1/health', { method })
    expect(reply.status()).toBe(401)
    expect(extraHeaders(reply, Object.keys(API_HEADERS))).toEqual([])
  })
}

test('an unknown path gets the plain 404, not a Next.js page', async ({ request }) => {
  const reply = await request.get('/nothing')
  expect(reply.status()).toBe(404)
  expect(await reply.text()).toBe('Not found.')
  expect(reply.headers()['content-type']).toBe('text/plain; charset=utf-8')
})
