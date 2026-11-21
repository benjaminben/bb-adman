import { afterEach, describe, it, expect, vi } from 'vitest'
import { notFound, pageHeaders, pagePolicy, textHeaders } from '../src/visitor/headers'
import { clock, makeApp, ORIGIN } from './visitor-setup'

// spec/approvals-service.md "Headers on replies from the catch-all" and spec/approvals-gallery.md
// "The page policy and nonce": each header set compared whole.

const TEXT = {
  'content-type': 'text/plain; charset=utf-8',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'cross-origin-opener-policy': 'same-origin',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow',
}
const HSTS = { 'strict-transport-security': 'max-age=31536000' }

const NONCE = 'AAECAwQFBgcICQoLDA0ODw=='
const STRICT =
  "default-src 'none'; script-src 'self' 'nonce-AAECAwQFBgcICQoLDA0ODw=='; " +
  "style-src 'self' 'nonce-AAECAwQFBgcICQoLDA0ODw=='; img-src 'self'; font-src 'self'; " +
  "connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; " +
  "object-src 'none'"

const PAGE = {
  'content-security-policy': STRICT,
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'cross-origin-opener-policy': 'same-origin',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow',
}

const https = new Request(`${ORIGIN}/l/aZ09aZ09aZ09`)
const http = new Request('http://localhost:3000/l/aZ09aZ09aZ09')
const whole = (headers: Headers) => Object.fromEntries(headers)

afterEach(() => vi.unstubAllEnvs())

describe('the plain text set', () => {
  it.each([
    ['https', https, { ...TEXT, ...HSTS }],
    ['http', http, TEXT],
  ])('over %s is exactly the spec set', (_, request, expected) => {
    expect(whole(textHeaders(request))).toEqual(expected)
  })

  it('is on the 404, with "Not found."', async () => {
    const reply = notFound(https)
    expect(reply.status).toBe(404)
    expect(whole(reply.headers)).toEqual({ ...TEXT, ...HSTS })
    expect(await reply.text()).toBe('Not found.')
  })
})

describe('the plain text set through the router', () => {
  it('is on the 404 for an unknown path', async () => {
    const app = makeApp(clock().now)
    const missing = await app.fetch(new Request(`${ORIGIN}/nothing`))
    expect(missing.status).toBe(404)
    expect(whole(missing.headers)).toEqual({ ...TEXT, ...HSTS })
  })
})

describe('the page policy and page set [approvals-gallery.md "The page policy and nonce"]', () => {
  it('is the strict one-line policy with the nonce in script-src and style-src', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(pagePolicy(NONCE)).toBe(STRICT)
  })

  it('adds only unsafe-eval to scripts and unsafe-inline to styles under next dev', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(pagePolicy(NONCE)).toBe(
      STRICT.replace(
        "script-src 'self' 'nonce-AAECAwQFBgcICQoLDA0ODw=='",
        "script-src 'self' 'nonce-AAECAwQFBgcICQoLDA0ODw==' 'unsafe-eval'",
      ).replace(
        "style-src 'self' 'nonce-AAECAwQFBgcICQoLDA0ODw=='",
        "style-src 'self' 'nonce-AAECAwQFBgcICQoLDA0ODw==' 'unsafe-inline'",
      ),
    )
  })

  it.each(['test', 'production', ''])('keeps the strict policy when NODE_ENV is %j', (mode) => {
    vi.stubEnv('NODE_ENV', mode)
    expect(pagePolicy(NONCE)).toBe(STRICT)
  })

  it.each([
    ['https', https, { ...PAGE, ...HSTS }],
    ['http', http, PAGE],
  ])('over %s is exactly the page set with that policy', (_, request, expected) => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(whole(pageHeaders(request, NONCE))).toEqual(expected)
  })
})
