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
  video: null,
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
  stamp: '0'.repeat(64),
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

describe('the picture [approvals-gallery.md "Components"]', () => {
  it('points at the picture route, lazily, with an empty alt inside the named button', () => {
    const markup = html(
      <VariantPicture
        slug={SLUG}
        variantKey="aaaa22"
        version={4}
        title="A t"
        sizeLine=""
        expired={false}
      />,
    )
    expect(markup).toMatch(/<img[^>]*src="\/l\/abcdEFGH2345\/p\/aaaa22\/4"/)
    expect(markup).toContain('alt=""')
    expect(markup).toContain('loading="lazy"')
  })

  it('draws the expired box and no picture when expired', () => {
    const markup = html(
      <VariantPicture
        slug={SLUG}
        variantKey="aaaa22"
        version={4}
        title="A t"
        sizeLine=""
        expired={true}
      />,
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
