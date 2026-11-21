import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createApp } from '../src/app'
import { cryptoBytes } from '../src/crypto/random'
import { html } from '../src/visitor/html'
import type { VisitorRoute } from '../src/visitor/routes'
import { addSignoff } from '../src/db/signoffs'
import { putVariant, type VariantRow } from '../src/db/variants'
import { addLink, clearTables, clock, db, enter, form, get, makeApp, ORIGIN } from './visitor-setup'

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

const NOW = Date.UTC(2026, 10, 21, 12, 0)
const AT = Date.UTC(2026, 0, 2, 3, 4)

const variant = (variantKey: string, position: number, over: Partial<VariantRow> = {}) => ({
  variantKey,
  position,
  title: `Title ${variantKey}`,
  sizeLine: '1080 × 1080',
  version: 2,
  pictureUrl: 'https://h.example/p.png',
  pictureExpiresAt: NOW + 1,
  ...over,
})

// A link holding hostile text everywhere a value is shown, and a session for it.
async function hostileGallery() {
  const app = makeApp(() => NOW)
  const link = await addLink(1, HOSTILE)
  await putVariant(db, link.id, variant('bbb234', 1, { title: HOSTILE, sizeLine: HOSTILE })).run()
  await putVariant(db, link.id, variant('aaa234', 0, { pictureExpiresAt: NOW })).run()
  const sign = (id: string, version: number, email: string) =>
    addSignoff(db, link.id, {
      id: id.repeat(24),
      variantKey: 'bbb234',
      version,
      email,
      createdAt: AT,
    })
  await sign('A', 2, "o'n&e/{x}@b.co").run()
  await sign('B', 2, `${HOSTILE}@b.co`).run()
  await sign('C', 1, 'old@b.co').run()
  const cookie = await enter(app, link.slug)
  const page = async (query = '') =>
    (await app.fetch(get(`/l/${link.slug}${query}`, cookie))).text()
  return { app, link, cookie, page }
}

function cardOf(page: string, key: string) {
  const start = page.indexOf(`id="v-${key}"`)
  return page.slice(start, page.indexOf('</article>', start))
}

describe('the gallery page [approvals-service.md "The pages", "Escaping"]', () => {
  it('shows every outside value only escaped, and carries no script', async () => {
    const page = await (await hostileGallery()).page()
    expect(page).not.toContain(HOSTILE)
    expect(page).not.toMatch(/<script|<\/style|\son\w+=|\sstyle=/i)
    expect(page).toContain(`<title>${ESCAPED}</title>`)
    expect(page).toContain(`<h1>${ESCAPED}</h1>`)
    expect(page).toContain(`alt="${ESCAPED}"`)
    expect(page).toContain(`<p class="size">${ESCAPED}</p>`)
    expect(page).toContain('o&#39;n&amp;e/{x}@b.co · 2026-01-02 03:04 UTC')
    expect(page).toContain(`${ESCAPED}@b.co · 2026-01-02 03:04 UTC`)
  })

  it('draws the cards in gallery order with pictures, sign-offs and forms', async () => {
    const { link, page: load } = await hostileGallery()
    const page = await load()
    expect(page).toContain(
      'Sign off on a variant by entering your email address. Anyone with this link can see who ' +
        'signed off, and can remove a sign-off.',
    )
    expect(page).toContain(`action="/l/${link.slug}/leave"`)
    expect(page.indexOf('id="v-aaa234"')).toBeLessThan(page.indexOf('id="v-bbb234"'))

    const expired = cardOf(page, 'aaa234')
    expect(expired).not.toContain('<img')
    expect(expired).toContain(
      'This picture has expired. Ask the person who sent the link to update the gallery.',
    )
    expect(expired).toContain('No sign-offs yet.')
    expect(expired).not.toContain('For an earlier version')

    const card = cardOf(page, 'bbb234')
    expect(card).toMatch(
      new RegExp(`<img\\s+loading="lazy"\\s+alt="[^"]*"\\s+src="/l/${link.slug}/p/bbb234/2"`),
    )
    expect(card).toContain('Signed off by')
    expect(card).toContain(`action="/l/${link.slug}/signoffs/${'A'.repeat(24)}/remove"`)
    expect(card.indexOf('For an earlier version')).toBeLessThan(card.indexOf('old@b.co'))
    expect(card.indexOf('For an earlier version')).toBeGreaterThan(card.indexOf('o&#39;n'))
    expect(card).toContain(`action="/l/${link.slug}/signoffs"`)
    expect(card).toMatch(/name="variant"\s+value="bbb234"/)
    expect(card).toMatch(/name="version"\s+value="2"/)
    expect(card).toMatch(/<input[^>]*type="email"[^>]*autocomplete="email"/)
    expect(card).toContain('>Sign off</button>')
  })

  it('says so when the gallery has no variants', async () => {
    const app = makeApp(() => NOW)
    const link = await addLink(1)
    const cookie = await enter(app, link.slug)
    const page = await (await app.fetch(get(`/l/${link.slug}`, cookie))).text()
    expect(page).toContain('Nothing to review yet.')
  })

  it('shows a notice only for a known m, and never repeats text from the address', async () => {
    const { page } = await hostileGallery()
    const notices: [string, string | null][] = [
      ['signed', 'Your sign-off was saved.'],
      ['removed', 'The sign-off was removed.'],
      [
        'changed',
        'This variant changed while you were looking. Look at it again, and sign off if you ' +
          'still approve.',
      ],
      ['bad-email', 'Enter a full email address, like name@company.com.'],
      ['constructor', null],
      ['__proto__', null],
      ['zzqqxx', null],
      ['%3Cb%3Ezzqq', null],
    ]
    for (const [m, text] of notices) {
      const shown = await page(`?m=${m}`)
      expect(shown.includes('class="notice"'), m).toBe(text !== null)
      if (text !== null) expect(shown).toContain(text)
      else expect(shown.toLowerCase()).not.toContain(decodeURIComponent(m).toLowerCase())
    }
  })

  it('gives the gallery, the 303 and the 403 page exactly the page headers', async () => {
    const { app, link, cookie } = await hostileGallery()
    expect(headersOf(await app.fetch(get(`/l/${link.slug}`, cookie)))).toEqual({ ...PAGE, ...HSTS })
    const left = await app.fetch(form(`/l/${link.slug}/leave`, {}, { cookie }))
    expect(headersOf(left)).toEqual({
      ...PAGE,
      ...HSTS,
      location: `/l/${link.slug}`,
      'set-cookie': `__Host-adman-${link.slug}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    })
    const refused = await app.fetch(form(`/l/${link.slug}/leave`, {}, { cookie }))
    expect(refused.status).toBe(403)
    expect(headersOf(refused)).toEqual({ ...PAGE, ...HSTS })
  })
})
