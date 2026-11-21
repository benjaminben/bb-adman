import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createApp } from '../src/app'
import { cryptoBytes } from '../src/crypto/random'
import { html } from '../src/visitor/html'
import type { VisitorRoute } from '../src/visitor/routes'
import { addLink, clearTables, clock, db, get, makeApp, ORIGIN } from './visitor-setup'

const CSP =
  "default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; " +
  "frame-ancestors 'none'; base-uri 'none'"

// spec "Headers on every page", whole.
const PAGE = {
  'content-type': 'text/html; charset=utf-8',
  'content-security-policy': CSP,
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'cross-origin-opener-policy': 'same-origin',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow',
}
const HSTS = { 'strict-transport-security': 'max-age=31536000' }
const headersOf = (reply: Response) => Object.fromEntries(reply.headers)

const HOSTILE = `<script>alert(1)</script> "q" 'a' & </style>`
const ESCAPED =
  '&lt;script&gt;alert(1)&lt;/script&gt; &quot;q&quot; &#39;a&#39; &amp; &lt;/style&gt;'

beforeEach(clearTables)

describe('the html template [approvals-service.md "Escaping"]', () => {
  it('escapes every value put into it and keeps nested html as it is', () => {
    const inner = html`<b>${'&'}</b>`
    const rows = [html`<i>${'<'}</i>`, html`<i>${'>'}</i>`]
    const page = html`<p title="${HOSTILE}">${HOSTILE}${inner}${rows}${42}</p>`
    expect(page.text).toBe(
      `<p title="${ESCAPED}">${ESCAPED}<b>&amp;</b><i>&lt;</i><i>&gt;</i>42</p>`,
    )
  })

  it('trusts only its own results, not an object that looks like one', () => {
    const fake = { text: '<b>', toString: () => '<b>' } as unknown as ReturnType<typeof html>
    expect(html`${fake}${[fake]}`.text).toBe('&lt;b&gt;&lt;b&gt;')
  })
})

describe('page headers [approvals-service.md "Headers on every page"]', () => {
  const app = makeApp(clock().now)

  it('gives the password page exactly the page headers, with HSTS on https only', async () => {
    const https = await app.fetch(get('/l/aZ09aZ09aZ09'))
    expect(https.status).toBe(200)
    expect(headersOf(https)).toEqual({ ...PAGE, ...HSTS })
    const http = await app.fetch(new Request('http://127.0.0.1:8787/l/aZ09aZ09aZ09'))
    expect(headersOf(http)).toEqual(PAGE)
  })

  it('serves the one stylesheet with its own three headers', async () => {
    const reply = await app.fetch(get('/gallery.css'))
    expect(reply.status).toBe(200)
    expect(headersOf(reply)).toEqual({
      'content-type': 'text/css; charset=utf-8',
      'x-content-type-options': 'nosniff',
      'cache-control': 'public, max-age=3600',
    })
    expect(await reply.text()).toContain(
      'grid-template-columns: repeat(auto-fill, minmax(260px, 1fr))',
    )
  })

  it('serves robots.txt refusing every robot', async () => {
    const reply = await app.fetch(get('/robots.txt'))
    expect(reply.status).toBe(200)
    expect(reply.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
    expect(await reply.text()).toBe('User-agent: *\nDisallow: /\n')
  })
})

describe('the fixed 500 reply', () => {
  afterEach(() => vi.restoreAllMocks())

  it('carries HSTS on https and not on http', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const failing: VisitorRoute = {
      name: 'gallery',
      method: 'GET',
      path: /^\/x$/,
      handler: async () => {
        throw new Error('no')
      },
    }
    const app = createApp({ DB: db }, { now: () => 0, random: cryptoBytes }, { visitor: [failing] })
    const https = await app.fetch(new Request(`${ORIGIN}/x`))
    const http = await app.fetch(new Request('http://127.0.0.1:8787/x'))
    expect(https.headers.get('Strict-Transport-Security')).toBe('max-age=31536000')
    expect(http.headers.has('Strict-Transport-Security')).toBe(false)
    expect(headersOf(http)['content-type']).toBe('text/plain; charset=utf-8')
  })
})

describe('the password page [approvals-service.md "The pages"]', () => {
  it('shows the form and no campaign name, the same bytes for a real and an unknown slug', async () => {
    const app = makeApp(clock().now)
    const link = await addLink(1, 'Secret Campaign')
    const real = await (await app.fetch(get(`/l/${link.slug}`))).text()
    expect(real).toContain('<h1>Review campaign</h1>')
    expect(real).toContain('Enter the password you were given.')
    expect(real).toContain(`action="/l/${link.slug}/enter"`)
    expect(real).toContain('autocomplete="current-password"')
    expect(real).toContain('>Open</button>')
    expect(real).not.toContain('Secret Campaign')
    expect(real).not.toMatch(/<script/i)
    await db.prepare('DELETE FROM link').run()
    expect(await (await app.fetch(get(`/l/${link.slug}`))).text()).toBe(real)
  })
})
