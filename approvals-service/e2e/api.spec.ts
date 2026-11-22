import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test'

// spec/approvals-service.md "Tests" (AP-14): the keyed API and the catch-all through `next start`.
// The key is the random one playwright.config.ts made for this run.
const KEY = process.env.E2E_API_KEY ?? ''
const auth = { Authorization: `Bearer ${KEY}` }

// Headers any HTTP server may add; anything else must be one the router itself sets.
// `content-encoding` is `next start`'s gzip of a reply body (Vercel compresses too); it carries no
// link data. Kept by the coordinator's ruling on the AP-14 review, as is `vary`.
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
  'referrer-policy': 'same-origin',
  'cross-origin-opener-policy': 'same-origin',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow',
}

test('health answers with the key, with exactly the API headers', async ({ request }) => {
  const reply = await request.get('/api/v1/health', { headers: auth })
  expect(reply.status()).toBe(200)
  expect(await reply.json()).toEqual({ service: 'adman-approvals', contract: 2 })
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

// AP-14 review: visitor forms and odd requests through Next.js. The base address is
// http://localhost:{port}, so the server's own origin is what `request.url` gives.
const PORT = process.env.E2E_PORT ?? ''
const OWN = `http://localhost:${PORT}`
const PROJECT = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const NAME = 'E2E secret campaign'
const PASSWORD = 'correct horse battery'

async function seed(request: APIRequestContext, campaignId: string): Promise<string> {
  const reply = await request.post('/api/v1/links', {
    headers: auth,
    data: { projectId: PROJECT, campaignId, campaignName: NAME, password: PASSWORD },
  })
  expect(reply.status()).toBe(201)
  return ((await reply.json()) as { slug: string }).slug
}

const enterWith = (request: APIRequestContext, slug: string, headers: Record<string, string>) =>
  request.post(`/l/${slug}/enter`, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    data: new URLSearchParams({ password: PASSWORD }).toString(),
    maxRedirects: 0,
  })

test("a form post with the server's own Origin is let in", async ({ request }) => {
  const slug = await seed(request, 'own-origin-abc234')
  const reply = await enterWith(request, slug, { Origin: OWN, 'Sec-Fetch-Site': 'same-origin' })
  expect(reply.status()).toBe(303)
  expect(reply.headers()['location']).toBe(`/l/${slug}`)
  expect(reply.headers()['set-cookie']).toMatch(new RegExp(`^__Host-adman-${slug}=`))
})

const REFUSED: [string, Record<string, string>][] = [
  ['the server named by another host', { Origin: `http://127.0.0.1:${PORT}` }],
  ['a cross-site Origin', { Origin: 'https://evil.example' }],
  [
    'a cross-site Origin with a client-sent X-Forwarded-Proto',
    { Origin: 'https://evil.example', 'X-Forwarded-Proto': 'https' },
  ],
  [
    'a cross-site Origin with a client-sent Host and X-Forwarded-Host',
    { Origin: 'http://evil.example', Host: 'evil.example', 'X-Forwarded-Host': 'evil.example' },
  ],
]

REFUSED.forEach(([name, headers], i) => {
  test(`a form post is refused with 403 and no cookie: ${name}`, async ({ request }) => {
    const slug = await seed(request, `refused-${i}-abc234`)
    const reply = await enterWith(request, slug, headers)
    expect(reply.status()).toBe(403)
    expect(reply.headers()['set-cookie']).toBeUndefined()
  })
})

test('an rsc: 1 header reaches no data', async ({ request }) => {
  const slug = await seed(request, 'rsc-header-abc234')
  const page = await request.get(`/l/${slug}`, { headers: { rsc: '1' } })
  // The page's own payload for a visitor with no session: the password page, no link data.
  expect(page.status()).toBe(200)
  const text = await page.text()
  expect(text).not.toContain(NAME)
  const api = await request.get(`/api/v1/links/${PROJECT}/rsc-header-abc234`, {
    headers: { rsc: '1' },
  })
  expect(api.status()).toBe(401)
  expect(await api.text()).not.toContain(NAME)
})

// Next.js answers a repeated slash itself, before the catch-all: a 308 to the collapsed path, whose
// body is that path. It never reaches a handler, so it holds no data; following it gets the
// router's own answer.
test('a // path reaches no data', async ({ request }) => {
  const slug = await seed(request, 'double-slash-abc234')
  const link = `/api/v1/links/${PROJECT}/double-slash-abc234`
  for (const [path, target] of [
    [`/${link}`, link],
    [`/api/v1//links/${PROJECT}/double-slash-abc234`, link],
    [`//l/${slug}`, `/l/${slug}`],
  ] as const) {
    const reply = await request.get(`${OWN}${path}`, { headers: auth, maxRedirects: 0 })
    expect(reply.status(), path).toBe(308)
    expect(reply.headers()['location'], path).toBe(target)
    expect(await reply.text(), path).toBe(target)
  }
})
