import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ReactElement } from 'react'
import PageError from '../app/l/[slug]/error'
import GlobalError from '../app/global-error'
import NotFound from '../app/not-found'
import { formatDate } from '../src/ui/format-date'
import { GalleryScreen } from '../src/ui/gallery-screen/gallery-screen'
import { PasswordScreen } from '../src/ui/password-screen/password-screen'
import { VariantPicture } from '../src/ui/variant-picture/variant-picture'
import type { GalleryView } from '../src/visitor/actions'

// spec/approvals-gallery.md "Look and structure", "Words" and "Tests": the components drawn to
// static markup, as the server sends them.
const html = (element: ReactElement) => renderToStaticMarkup(element)
const SLUG = 'abcdEFGH2345'
const NOW = Date.UTC(2026, 10, 21, 12, 5)

type Variant = GalleryView['variants'][number]
type Signoff = GalleryView['signoffs'][number]

const variant = (variantKey: string, version = 1, extra: Partial<Variant> = {}): Variant => ({
  variantKey,
  position: 0,
  title: `Title ${variantKey}`,
  sizeLine: '1080 × 1080',
  version,
  expired: false,
  ...extra,
})

const signoff = (n: number, variantKey: string, version: number, createdAt = NOW): Signoff => ({
  id: `sign${n}`.padEnd(24, 'x'),
  variantKey,
  version,
  email: `person${n}@example.com`,
  createdAt,
})

const view = (extra: Partial<GalleryView> = {}): GalleryView => ({
  link: { slug: SLUG, campaignName: 'Spring shapes' },
  variants: [variant('aaaa22')],
  signoffs: [],
  reviewer: null,
  notice: null,
  ...extra,
})

// True when some <tag> in the markup holds every given attribute, in any order.
const hasTag = (markup: string, tag: string, attrs: string[]) =>
  [...markup.matchAll(new RegExp(`<${tag}([^>]*)>`, 'g'))].some((m) =>
    attrs.every((attr) => ` ${m[1] ?? ''}`.includes(` ${attr}`)),
  )

const posts = (path: string) => ['method="post"', `action="${path}"`]

// Everything a browser would show, without tags.
const text = (markup: string) =>
  markup
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

describe('visitor text is drawn only as escaped text [approvals-gallery.md "Look and structure"]', () => {
  const HOSTILE = `<script>alert(1)</script>"'&</style>`
  const ESCAPED = '&lt;script&gt;alert(1)&lt;/script&gt;&quot;&#x27;&amp;&lt;/style&gt;'
  const ROWS: [string, GalleryView][] = [
    ['campaign name', view({ link: { slug: SLUG, campaignName: HOSTILE } })],
    ['title', view({ variants: [variant('aaaa22', 1, { title: HOSTILE })] })],
    ['size line', view({ variants: [variant('aaaa22', 1, { sizeLine: HOSTILE })] })],
    ['email', view({ signoffs: [{ ...signoff(1, 'aaaa22', 1), email: HOSTILE }] })],
  ]

  it.each(ROWS)('escapes a %s', (_name, given) => {
    const markup = html(<GalleryScreen view={given} />)
    expect(markup).not.toContain('<script')
    expect(markup).not.toContain('</style>')
    expect(markup).toContain(ESCAPED)
  })

  it("does not draw an older version's sign-off email at all", () => {
    const given = view({ signoffs: [{ ...signoff(1, 'aaaa22', 0), email: HOSTILE }] })
    const markup = html(<GalleryScreen view={given} />)
    expect(markup).not.toContain('<script')
    expect(markup).not.toContain(ESCAPED)
    expect(markup).not.toContain('alert(1)')
  })
})

describe('the password page [approvals-gallery.md "Words"]', () => {
  it('has the heading, the sentence and a labelled password field posting to enter', () => {
    const markup = html(<PasswordScreen slug={SLUG} notice={null} />)
    expect(markup).toContain('<title>Review campaign</title>')
    expect(markup).toContain('<h1')
    expect(text(markup)).toBe(
      'Review campaign Review campaign Enter the password you were given. Password Open',
    )
    expect(hasTag(markup, 'form', posts(`/l/${SLUG}/enter`))).toBe(true)
    const field = ['type="password"', 'name="password"', 'autoComplete="current-password"']
    expect(hasTag(markup, 'input', [...field, 'required=""'])).toBe(true)
  })

  it('shows the wrong-password notice in the error tone', () => {
    const markup = html(<PasswordScreen slug={SLUG} notice="wrong-password" />)
    expect(markup).toContain('role="alert"')
    expect(text(markup)).toContain(
      'That password did not work. If you have tried many times, wait 15 minutes and try again.',
    )
  })
})

describe('the gallery page [approvals-gallery.md "Words"]', () => {
  it('has the campaign name as title and heading, the intro and the Leave form', () => {
    const markup = html(<GalleryScreen view={view()} />)
    expect(markup).toContain('<title>Spring shapes</title>')
    expect(markup).toMatch(/<h1[^>]*>Spring shapes<\/h1>/)
    expect(text(markup)).toContain(
      'Sign off on a variant by entering your email address. Anyone with this link can see who ' +
        'signed off, and can remove a sign-off.',
    )
    expect(hasTag(markup, 'form', posts(`/l/${SLUG}/leave`))).toBe(true)
    expect(text(markup)).toContain('Leave')
  })

  const NOTICE_ROWS: [GalleryView['notice'], string, string][] = [
    ['signed', 'status', 'Your sign-off was saved.'],
    ['removed', 'status', 'The sign-off was removed.'],
    ['changed', 'status', 'This variant changed while you were looking.'],
    ['bad-email', 'alert', 'Enter a full email address, like name@company.com.'],
  ]

  it.each(NOTICE_ROWS)('shows the %s notice with role %s', (notice, role, words) => {
    const markup = html(<GalleryScreen view={view({ notice })} />)
    expect(markup).toContain(`role="${role}"`)
    expect(text(markup)).toContain(words)
  })

  it('shows no notice box without a notice', () => {
    const markup = html(<GalleryScreen view={view()} />)
    expect(markup).not.toMatch(/role="(status|alert)"/)
  })

  it('says so when there are no variants', () => {
    const markup = html(<GalleryScreen view={view({ variants: [] })} />)
    expect(text(markup)).toContain('Nothing to review yet.')
    expect(markup).not.toContain('<article')
  })

  it('draws one card per variant in gallery order, each with its sign-off form', () => {
    const variants = [variant('cccc44', 1, { position: 1 }), variant('aaaa22', 3, { position: 0 })]
    const markup = html(<GalleryScreen view={view({ variants })} />)
    expect([...markup.matchAll(/<article id="v-(\w+)"/g)].map((m) => m[1])).toEqual([
      'aaaa22',
      'cccc44',
    ])
    expect(hasTag(markup, 'form', posts(`/l/${SLUG}/signoffs`))).toBe(true)
    expect(markup).toContain('<input type="hidden" name="variant" value="aaaa22"/>')
    expect(markup).toContain('<input type="hidden" name="version" value="3"/>')
    const field = ['type="email"', 'name="email"', 'autoComplete="email"', 'required=""']
    expect(hasTag(markup, 'input', field)).toBe(true)
  })

  it('groups current and earlier sign-offs, leaving out an empty earlier list', () => {
    const one = view({ variants: [variant('aaaa22', 2)] })
    const none = text(html(<GalleryScreen view={one} />))
    expect(none).toContain('Signed off by No sign-offs yet.')

    const signoffs = [signoff(1, 'aaaa22', 2), signoff(2, 'aaaa22', 1)]
    const markup = html(<GalleryScreen view={{ ...one, signoffs }} />)
    const shown = text(markup)
    expect(shown).toContain('Signed off by person1@example.com · 2026-11-21 12:05 UTC')
    expect(hasTag(markup, 'form', posts(`/l/${SLUG}/signoffs/${signoffs[0]?.id}/remove`))).toBe(
      true,
    )
  })

  it('gives every field a label', () => {
    const screens = [
      html(<PasswordScreen slug={SLUG} notice="wrong-password" />),
      html(<GalleryScreen view={view({ variants: [variant('aaaa22'), variant('bbbb33')] })} />),
    ]
    for (const markup of screens) {
      const inputs = [...markup.matchAll(/<input([^>]*)>/g)].map((m) => m[1] ?? '')
      const fields = inputs.filter((attrs) => !attrs.includes('type="hidden"'))
      expect(fields.length).toBeGreaterThan(0)
      for (const attrs of fields) {
        const id = /id="([^"]+)"/.exec(attrs)?.[1]
        expect(id, attrs).toBeDefined()
        expect(markup).toContain(`<label for="${id}"`)
      }
    }
  })
})

describe('the picture [approvals-gallery.md "Components"]', () => {
  it('points at the picture route, lazily, with the title as alt text', () => {
    const markup = html(
      <VariantPicture slug={SLUG} variantKey="aaaa22" version={4} title="A t" expired={false} />,
    )
    expect(markup).toMatch(/<img[^>]*src="\/l\/abcdEFGH2345\/p\/aaaa22\/4"/)
    expect(markup).toContain('alt="A t"')
    expect(markup).toContain('loading="lazy"')
  })

  it('draws the expired box and no picture when expired', () => {
    const markup = html(
      <VariantPicture slug={SLUG} variantKey="aaaa22" version={4} title="A t" expired={true} />,
    )
    expect(markup).not.toContain('<img')
    expect(text(markup)).toBe(
      'This picture has expired. Ask the person who sent the link to update the gallery.',
    )
  })
})

describe('formatDate and groupSignoffs [approvals-gallery.md "Components"]', () => {
  it.each([
    [0, '1970-01-01 00:00 UTC'],
    [Date.UTC(2026, 0, 2, 3, 4, 59, 999), '2026-01-02 03:04 UTC'],
    [Date.UTC(2026, 11, 31, 23, 59), '2026-12-31 23:59 UTC'],
  ])('formats %d as %s', (ms, expected) => {
    expect(formatDate(ms)).toBe(expected)
  })
})

describe('the fixed pages [approvals-gallery.md "Routes"]', () => {
  const SECRET = Object.assign(new Error('secret detail zzqq'), { digest: 'digest zzqq' })
  const ROWS: [string, ReactElement, string][] = [
    [
      'the page error',
      <PageError key="a" error={SECRET} />,
      'Something went wrong. Try again later.',
    ],
    [
      'the global error',
      <GlobalError key="b" error={SECRET} />,
      'Something went wrong. Try again later.',
    ],
    ['not found', <NotFound key="c" />, 'Not found.'],
  ]

  it.each(ROWS)('%s shows only its fixed sentence', (_name, element, sentence) => {
    const markup = html(element)
    expect(text(markup.replace(/<title>[^<]*<\/title>/, ''))).toBe(sentence)
    expect(markup).not.toContain('zzqq')
  })
})
