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

describe('the gallery page [round-2-approvals.md "The page", "The sidebar", "The cards"]', () => {
  const ANN = 'ann@example.com'
  const mine = (variantKey: string, version = 1): Signoff => ({
    ...signoff(9, variantKey, version),
    email: ANN,
  })
  // The page's parts: the sidebar, the main column, and one card without its lightbox.
  const sidebar = (markup: string) => /<aside[\s\S]*<\/aside>/.exec(markup)?.[0] ?? ''
  const column = (markup: string) => /<main[\s\S]*<\/main>/.exec(markup)?.[0] ?? ''
  const card = (markup: string, variantKey: string) =>
    (
      new RegExp(`<article id="v-${variantKey}"[\\s\\S]*?</article>`).exec(markup)?.[0] ?? ''
    ).replace(/<dialog[\s\S]*?<\/dialog>/g, '')

  it('has the campaign name as title and heading, the instructions and the Log out form', () => {
    const markup = html(<GalleryScreen view={view()} />)
    expect(markup).toContain('<title>Spring shapes</title>')
    expect(sidebar(markup)).toMatch(/<h1[^>]*>Spring shapes<\/h1>/)
    expect(text(sidebar(markup))).toContain(
      'Look at each variant and sign off on the ones you approve. Your email is saved with each ' +
        'sign-off. Anyone with this link can see who signed off, and can remove a sign-off.',
    )
    expect(hasTag(markup, 'form', posts(`/l/${SLUG}/leave`))).toBe(true)
    expect(text(sidebar(markup))).toContain('Log out')
    expect(text(markup)).not.toContain('Leave')
  })

  it('puts the sidebar with the reviewer form before the main column', () => {
    const markup = html(<GalleryScreen view={view()} />)
    expect(markup.indexOf('<aside')).toBeGreaterThan(-1)
    expect(markup.indexOf('<aside')).toBeLessThan(markup.indexOf('<main'))
    expect(
      hasTag(sidebar(markup), 'form', ['id="reviewer"', ...posts(`/l/${SLUG}/reviewer`)]),
    ).toBe(true)
    expect(column(markup)).toContain('<article')
  })

  const NOTICE_ROWS: [GalleryView['notice'], string, 'main' | 'sidebar', string][] = [
    ['signed', 'status', 'main', 'Your sign-off was saved.'],
    ['removed', 'status', 'main', 'The sign-off was removed.'],
    ['changed', 'status', 'main', 'This variant changed while you were looking.'],
    ['signed-all', 'status', 'main', 'Your sign-offs were saved.'],
    ['gallery-changed', 'status', 'main', 'The gallery changed while you were looking.'],
    ['bad-email', 'alert', 'sidebar', 'Enter a full email address, like name@company.com.'],
    ['email-saved', 'status', 'sidebar', 'Your email is saved until you log out or close'],
  ]

  it.each(NOTICE_ROWS)('shows the %s notice with role %s in the %s', (notice, role, at, words) => {
    const markup = html(<GalleryScreen view={view({ notice })} />)
    const [here, there] = at === 'main' ? [column, sidebar] : [sidebar, column]
    expect(here(markup)).toContain(`role="${role}"`)
    expect(text(here(markup))).toContain(words)
    expect(there(markup)).not.toMatch(/role="(status|alert)"/)
  })

  it('shows no notice box without a notice', () => {
    const markup = html(<GalleryScreen view={view()} />)
    expect(markup).not.toMatch(/role="(status|alert)"/)
  })

  it('says so when there are no variants', () => {
    const markup = html(<GalleryScreen view={view({ variants: [] })} />)
    expect(text(column(markup))).toContain('Nothing to review yet.')
    expect(markup).not.toContain('<article')
    expect(text(sidebar(markup))).toContain('Nothing to sign off yet.')
  })

  it('draws one card per variant in gallery order, each with its picture button and lightbox', () => {
    const variants = [
      variant('cccc44', 1, { position: 1, sizeLine: '1080 × 1920 · Story' }),
      variant('aaaa22', 3, { position: 0 }),
    ]
    const markup = html(<GalleryScreen view={view({ variants })} />)
    expect([...markup.matchAll(/<article id="v-(\w+)"/g)].map((m) => m[1])).toEqual([
      'aaaa22',
      'cccc44',
    ])
    expect(card(markup, 'cccc44')).toMatch(/<h2 id="t-cccc44"[^>]*>Title cccc44<\/h2>/)
    expect(markup).toContain('aria-labelledby="t-cccc44"')
    const opens = ['type="button"', 'commandfor="view-cccc44"', 'command="show-modal"']
    expect(
      hasTag(card(markup, 'cccc44'), 'button', [
        ...opens,
        'aria-label="View larger: Title cccc44"',
      ]),
    ).toBe(true)
    const img = ['src="/l/abcdEFGH2345/p/cccc44/1"', 'alt=""', 'width="1080"', 'height="1920"']
    expect(hasTag(card(markup, 'cccc44'), 'img', [...img, 'loading="lazy"'])).toBe(true)
    const article = /<article id="v-cccc44"[\s\S]*?<\/article>/.exec(markup)?.[0] ?? ''
    expect(article).toContain('<dialog id="view-cccc44"')
  })

  const SIGN = (variantKey: string, version = 1) => [
    'type="submit"',
    'form="reviewer"',
    'name="one"',
    `value="${variantKey}.${version}"`,
  ]
  const TICK = 'aria-label="Signed off by you. Open to view or remove."'

  it('asks for a sign-off on every live card while no email is saved', () => {
    const signoffs = [{ ...mine('aaaa22'), email: 'other@example.com' }, mine('bbbb33')]
    const variants = [variant('aaaa22'), variant('bbbb33', 1, { position: 1 })]
    const markup = html(<GalleryScreen view={view({ variants, signoffs })} />)
    for (const key of ['aaaa22', 'bbbb33']) {
      expect(hasTag(card(markup, key), 'button', SIGN(key))).toBe(true)
      expect(text(card(markup, key))).toContain('Waiting for your sign-off.')
      expect(card(markup, key)).not.toContain(TICK)
      expect(text(card(markup, key))).toContain('Signed off by 1')
    }
    expect(text(sidebar(markup))).toContain('Signs every variant shown, as the email above.')
  })

  it('draws the tick, not the button, on a card this reviewer signed', () => {
    const variants = [variant('aaaa22', 2), variant('bbbb33', 1, { position: 1 })]
    const signoffs = [mine('aaaa22', 2), signoff(1, 'aaaa22', 2), signoff(2, 'bbbb33', 1)]
    const markup = html(<GalleryScreen view={view({ variants, signoffs, reviewer: ANN })} />)
    const signed = card(markup, 'aaaa22')
    expect(hasTag(signed, 'button', ['type="button"', 'commandfor="view-aaaa22"', TICK])).toBe(true)
    expect(signed).not.toContain('name="one"')
    expect(text(signed)).not.toContain('Waiting for your sign-off.')
    expect(text(signed)).toContain('Signed off by 2')
    // Signed by another reviewer only: still waiting for this one.
    expect(hasTag(card(markup, 'bbbb33'), 'button', SIGN('bbbb33'))).toBe(true)
    expect(text(card(markup, 'bbbb33'))).toContain('Signed off by 1')
    expect(text(sidebar(markup))).toContain('1 left to sign off.')
  })

  it("counts no line when a card has no sign-off, and never shows another reviewer's email", () => {
    const signoffs = [signoff(1, 'bbbb33', 1)]
    const variants = [variant('aaaa22'), variant('bbbb33', 1, { position: 1 })]
    const markup = html(<GalleryScreen view={view({ variants, signoffs })} />)
    expect(text(card(markup, 'aaaa22'))).not.toContain('Signed off by')
    expect(card(markup, 'bbbb33')).not.toContain('person1@example.com')
  })

  it('draws the expiry sentence and no button on an expired card', () => {
    const variants = [variant('aaaa22', 1, { expired: true })]
    const markup = html(<GalleryScreen view={view({ variants, reviewer: ANN })} />)
    const expired = card(markup, 'aaaa22')
    expect(text(expired)).toContain(
      'This picture has expired. Ask the person who sent the link to update the gallery.',
    )
    expect(expired).not.toContain('<img')
    expect(expired).not.toContain('<button')
    expect(text(sidebar(markup))).toContain('Nothing to sign off yet.')
  })

  it('counts every live card signed by this reviewer as done', () => {
    const variants = [variant('aaaa22'), variant('bbbb33', 1, { position: 1, expired: true })]
    const markup = html(
      <GalleryScreen view={view({ variants, signoffs: [mine('aaaa22')], reviewer: ANN })} />,
    )
    expect(text(sidebar(markup))).toContain('You have signed off on every variant.')
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Sign off all…<\/button>/)
  })

  it("does not take an older version's sign-off as this reviewer's", () => {
    const variants = [variant('aaaa22', 2)]
    const markup = html(
      <GalleryScreen view={view({ variants, signoffs: [mine('aaaa22', 1)], reviewer: ANN })} />,
    )
    expect(hasTag(card(markup, 'aaaa22'), 'button', SIGN('aaaa22', 2))).toBe(true)
    expect(card(markup, 'aaaa22')).not.toContain(TICK)
    expect(text(card(markup, 'aaaa22'))).not.toContain('Signed off by')
  })

  it('fills the email field with the saved email, escaped', () => {
    const markup = html(<GalleryScreen view={view({ reviewer: 'a"<b>@example.com' })} />)
    expect(markup).toContain('value="a&quot;&lt;b&gt;@example.com"')
    expect(markup).not.toContain('<b>')
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
