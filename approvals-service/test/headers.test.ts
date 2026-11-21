import { afterEach, describe, it, expect, vi } from 'vitest'
import { createApp } from '../src/app'
import { cryptoBytes } from '../src/crypto/random'
import {
  emptyNotFound,
  notFound,
  pageHeaders,
  pictureHeaders,
  pagePolicy,
  redirect,
  refused,
  textHeaders,
} from '../src/visitor/headers'
import type { NoticeKey } from '../src/visitor/notices'
import type { VisitorRoute } from '../src/visitor/routes'
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
} from './visitor-setup'

// spec/approvals-service.md "Headers on replies from the catch-all" and spec/approvals-gallery.md
// "The page policy and nonce": each header set compared whole.

const TEXT = {
  'content-type': 'text/plain; charset=utf-8',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'same-origin',
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
  'referrer-policy': 'same-origin',
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

  it('is on the 403, with the refusal sentence', async () => {
    const reply = refused(http)
    expect(reply.status).toBe(403)
    expect(whole(reply.headers)).toEqual(TEXT)
    expect(await reply.text()).toBe(
      'This form could not be sent. Open the link again and try once more.',
    )
  })

  it.each([
    ['nothing else', {}, '/l/aZ09aZ09aZ09', {}],
    ['a cookie', { cookie: 'a=b; Path=/' }, '/l/aZ09aZ09aZ09', { 'set-cookie': 'a=b; Path=/' }],
    ['a notice', { m: 'wrong-password' as const }, '/l/aZ09aZ09aZ09?m=wrong-password', {}],
  ])('is on every 303, with %s, Location and an empty body', async (_, options, at, extra) => {
    const reply = redirect(https, 'aZ09aZ09aZ09', options)
    expect(reply.status).toBe(303)
    expect(whole(reply.headers)).toEqual({ ...TEXT, ...HSTS, location: at, ...extra })
    expect(await reply.text()).toBe('')
  })

  it.each(['', 'aZ09aZ09aZ0', 'aZ09aZ09aZ09a', '../x/aZ09aZ0', 'aZ09aZ09aZ0/', 'https://e.x'])(
    'never builds a 303 from %j, which is not a checked slug',
    (slug) => {
      expect(() => redirect(https, slug)).toThrow(TypeError)
    },
  )

  it.each(['wrong-passwordx', '__proto__', 'toString', 'signed&x=1', ''])(
    'never builds a 303 with the notice %j, which is not a key of the table',
    (m) => {
      expect(() => redirect(https, 'aZ09aZ09aZ09', { m: m as NoticeKey })).toThrow(TypeError)
    },
  )
})

describe('the plain text set through the router', () => {
  it('is on the 404 for an unknown path', async () => {
    const app = makeApp(clock().now)
    const missing = await app.fetch(new Request(`${ORIGIN}/nothing`))
    expect(missing.status).toBe(404)
    expect(whole(missing.headers)).toEqual({ ...TEXT, ...HSTS })
  })

  it('is on the 403 for a refused form and the 303 after a right password', async () => {
    await clearTables()
    const app = makeApp(clock().now)
    const link = await addLink(1)
    const cross = form(
      `/l/${link.slug}/enter`,
      { password: PASSWORD },
      { headers: { Origin: 'https://evil.example' } },
    )
    const refusedReply = await app.fetch(cross)
    expect(refusedReply.status).toBe(403)
    expect(whole(refusedReply.headers)).toEqual({ ...TEXT, ...HSTS })
    const reply = await app.fetch(form(`/l/${link.slug}/enter`, { password: PASSWORD }))
    expect(reply.status).toBe(303)
    const { 'set-cookie': cookie, ...rest } = whole(reply.headers)
    expect(rest).toEqual({ ...TEXT, ...HSTS, location: `/l/${link.slug}` })
    expect(cookie).toMatch(new RegExp(`^__Host-adman-${link.slug}=`))
  })

  it('is on the 303 after Leave, whole: the cleared cookie and an empty body', async () => {
    await clearTables()
    const app = makeApp(clock().now)
    const link = await addLink(1)
    const cookie = await enter(app, link.slug)
    const reply = await app.fetch(form(`/l/${link.slug}/leave`, {}, { cookie }))
    expect(reply.status).toBe(303)
    expect(whole(reply.headers)).toEqual({
      ...TEXT,
      ...HSTS,
      location: `/l/${link.slug}`,
      'set-cookie': `__Host-adman-${link.slug}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    })
    expect(await reply.text()).toBe('')
  })

  it('is on the fixed 500 over http, without HSTS', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const failing: VisitorRoute = {
      name: 'x',
      method: 'GET',
      path: /^\/x$/,
      handler: async () => {
        throw new Error('no')
      },
    }
    const app = createApp({ DB: db }, { now: () => 0, random: cryptoBytes }, { visitor: [failing] })
    const reply = await app.fetch(new Request('http://localhost:3000/x'))
    expect(reply.status).toBe(500)
    expect(whole(reply.headers)).toEqual(TEXT)
    vi.restoreAllMocks()
  })
})

describe('the page policy and page set [approvals-gallery.md "The page policy and nonce"]', () => {
  it('is the strict one-line policy with the nonce in script-src and style-src', () => {
    expect(pagePolicy(NONCE)).toBe(STRICT)
    expect(pagePolicy(NONCE, false)).toBe(STRICT)
  })

  const BAD_NONCES = [
    '',
    'AAECAwQFBgcICQoLDA0ODw=',
    'AAECAwQFBgcICQoLDA0ODw===',
    'AAECAwQFBgcICQoLDA0OD;==',
    "AAECAwQFBgcICQoLDA0OD'==",
    'AAECAwQFBgcICQoLDA0OD ==',
    'AAECAwQFBgcICQoLDA0OD-==',
    'AAECAwQFBgcICQoLDA0OD_==',
    'AAECAwQFBgcICQoLDA0ODwA',
  ]
  it.each(BAD_NONCES)('refuses the nonce %j, which is not 16 bytes as base64', (nonce) => {
    expect(() => pagePolicy(nonce)).toThrow(TypeError)
    expect(() => pageHeaders(https, nonce)).toThrow(TypeError)
  })

  it('takes a nonce of 16 random bytes as base64', () => {
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
    expect(pagePolicy(nonce)).toContain(`'nonce-${nonce}'`)
  })

  it('adds only unsafe-eval to scripts and unsafe-inline to styles under next dev', () => {
    expect(pagePolicy(NONCE, true)).toBe(
      STRICT.replace(
        "script-src 'self' 'nonce-AAECAwQFBgcICQoLDA0ODw=='",
        "script-src 'self' 'nonce-AAECAwQFBgcICQoLDA0ODw==' 'unsafe-eval'",
      ).replace(
        "style-src 'self' 'nonce-AAECAwQFBgcICQoLDA0ODw=='",
        "style-src 'self' 'nonce-AAECAwQFBgcICQoLDA0ODw==' 'unsafe-inline'",
      ),
    )
  })

  it('stays strict whatever NODE_ENV says, since it reads no environment', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(pagePolicy(NONCE)).toBe(STRICT)
    expect(whole(pageHeaders(http, NONCE))['content-security-policy']).toBe(STRICT)
  })

  it.each([
    ['https', https, { ...PAGE, ...HSTS }],
    ['http', http, PAGE],
  ])('over %s is exactly the page set with that policy', (_, request, expected) => {
    expect(whole(pageHeaders(request, NONCE))).toEqual(expected)
  })
})

describe('the 303 back to a variant [approvals-service-visitor.md "Visitor routes and logic"]', () => {
  it.each([
    ['a notice', { m: 'signed' as const, variant: 'abc234' }, '/l/aZ09aZ09aZ09?m=signed#v-abc234'],
    ['no notice', { variant: 'zzzzzz' }, '/l/aZ09aZ09aZ09#v-zzzzzz'],
  ])('ends the address with #v-{variant}, with %s', async (_, options, at) => {
    const reply = redirect(https, 'aZ09aZ09aZ09', options)
    expect(reply.status).toBe(303)
    expect(whole(reply.headers)).toEqual({ ...TEXT, ...HSTS, location: at })
  })

  it.each(['', 'abc23', 'abc2345', 'ABC234', 'abc01i', 'abc23/', 'abc23#', 'a"c234'])(
    'never builds a 303 with the variant %j, which is not a variant key',
    (variant) => {
      expect(() => redirect(https, 'aZ09aZ09aZ09', { m: 'signed', variant })).toThrow(TypeError)
    },
  )
})

describe('the picture set and its 404 [approvals-service-visitor.md "Pictures"]', () => {
  it.each(['image/png', 'image/jpeg'] as const)('is exactly the spec set for %s', (type) => {
    expect(whole(pictureHeaders(type))).toEqual({
      'content-type': type,
      'x-content-type-options': 'nosniff',
      'cache-control': 'no-store',
      'content-security-policy': "default-src 'none'; sandbox",
      'cross-origin-resource-policy': 'same-origin',
      'referrer-policy': 'no-referrer',
    })
  })

  it('fails with a 404, an empty body and the plain text headers', async () => {
    const reply = emptyNotFound(https)
    expect(reply.status).toBe(404)
    expect(whole(reply.headers)).toEqual({ ...TEXT, ...HSTS })
    expect(await reply.text()).toBe('')
  })
})
