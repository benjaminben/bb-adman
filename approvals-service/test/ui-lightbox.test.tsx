import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ReactElement } from 'react'
import { CardSignoff } from '../src/ui/card-signoff/card-signoff'
import { formatDate } from '../src/ui/format-date'
import { Lightbox } from '../src/ui/lightbox/lightbox'
import { pictureSize } from '../src/ui/picture-size'
import { SignoffTick } from '../src/ui/signoff-tick/signoff-tick'
import type { Signoff, Variant } from '../src/visitor/actions'

// spec/phases/round-2-approvals.md "The cards", "The lightbox" and S-13 (R2A-6): the card parts
// and the lightbox drawn to static markup, as the server sends them.
const html = (element: ReactElement) => renderToStaticMarkup(element)
const SLUG = 'abcdEFGH2345'
const KEY = 'aaaa22'
const NOW = Date.UTC(2026, 10, 21, 12, 5)
const ANN = 'ann@example.com'
const EXPIRED = 'This picture has expired. Ask the person who sent the link to update the gallery.'

const variant = (extra: Partial<Variant> = {}): Variant => ({
  variantKey: KEY,
  position: 0,
  title: 'Blue circle, square',
  sizeLine: '1080 × 1350 · Portrait',
  version: 3,
  expired: false,
  video: null,
  ...extra,
})

const signoff = (n: number, email: string, createdAt = NOW, extra: Partial<Signoff> = {}) => ({
  id: `sign${n}`.padEnd(24, 'x'),
  variantKey: KEY,
  version: 3,
  email,
  createdAt,
  ...extra,
})

const box = (signoffs: Signoff[] = [], reviewer: string | null = null, given = variant()) =>
  html(<Lightbox slug={SLUG} variant={given} signoffs={signoffs} reviewer={reviewer} />)

// Every <tag ...> in the markup, as its attribute text.
const tags = (markup: string, tag: string) =>
  [...markup.matchAll(new RegExp(`<${tag}(\\s[^>]*)?>`, 'g'))].map((m) => ` ${m[1] ?? ''}`)

const hasTag = (markup: string, tag: string, attrs: string[]) =>
  tags(markup, tag).some((found) => attrs.every((attr) => found.includes(` ${attr}`)))

const text = (markup: string) =>
  markup
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const signButton = ['type="submit"', 'form="reviewer"', 'name="one"', `value="${KEY}.3"`]

describe('pictureSize [round-2 "The page: layout"]', () => {
  it.each([
    ['1080 × 1350 · Portrait', 1080, 1350],
    ['1200×628', 1200, 628],
    ['1200   ×   628', 1200, 628],
    ['20000 × 1', 20000, 1],
    ['00500 × 300', 500, 300],
    ['20001 × 1080', 1080, 1080],
    ['1080 × 0', 1080, 1080],
    ['123456 × 1080', 1080, 1080],
    ['1080 x 1080', 1080, 1080],
    [' 1080 × 1350', 1080, 1080],
    ['Square', 1080, 1080],
    ['', 1080, 1080],
  ])('%j gives %i × %i', (line, width, height) => {
    expect(pictureSize(line)).toEqual({ width, height })
  })
})

describe('the card parts [round-2 "The cards"]', () => {
  it('signs one variant through the reviewer form, named for its title', () => {
    const markup = html(
      <CardSignoff slug={SLUG} variantKey={KEY} version={3} title="Blue circle, square" />,
    )
    expect(
      hasTag(markup, 'button', [...signButton, 'aria-label="Sign off: Blue circle, square"']),
    ).toBe(true)
    expect(markup.toLowerCase()).not.toContain('formnovalidate')
    expect(markup).toMatch(/<p class="hidden-text">Waiting for your sign-off\.<\/p>/)
    expect(text(markup)).toBe('Waiting for your sign-off. Sign off')
  })

  it('draws the tick as a button that opens the lightbox, its check hidden from readers', () => {
    const markup = html(<SignoffTick variantKey={KEY} />)
    const opens = ['type="button"', `commandfor="view-${KEY}"`, 'command="show-modal"']
    const name = 'aria-label="Signed off by you. Open to view or remove."'
    expect(hasTag(markup, 'button', [...opens, name])).toBe(true)
    expect(hasTag(markup, 'svg', ['aria-hidden="true"'])).toBe(true)
    expect(text(markup)).toBe('')
  })
})

describe('the lightbox [round-2 "The lightbox"]', () => {
  it('is a dialog named by its title, with Close first', () => {
    const markup = box()
    const dialog = [`id="view-${KEY}"`, `aria-labelledby="lt-${KEY}"`, 'data-lightbox=""']
    expect(hasTag(markup, 'dialog', dialog)).toBe(true)
    expect(markup).toMatch(new RegExp(`<h2[^>]*id="lt-${KEY}"[^>]*>Blue circle, square</h2>`))
    const first = tags(markup, 'button')[0] ?? ''
    for (const attr of ['type="button"', `commandfor="view-${KEY}"`, 'command="close"']) {
      expect(first).toContain(` ${attr}`)
    }
    expect(text(markup).startsWith('Blue circle, square 1080 × 1350 · Portrait Close')).toBe(true)
    expect(markup).not.toContain('<form')
  })

  it('shows the same picture address as the card, large, sized from its size line', () => {
    const picture = [
      `src="/l/${SLUG}/p/${KEY}/3"`,
      'alt="Blue circle, square"',
      'width="1080"',
      'height="1350"',
      'loading="lazy"',
    ]
    expect(hasTag(box(), 'img', picture)).toBe(true)
  })

  it.each([
    ['no email saved', null, [], 'Uses the email under “Signing off as:”.'],
    ['an email saved', ANN, [], `Signing off as ${ANN}.`],
    [
      'an email saved, signed by another',
      ANN,
      [signoff(1, 'bo@example.com')],
      `Signing off as ${ANN}.`,
    ],
    [
      'an older sign-off by this email',
      ANN,
      [signoff(1, ANN, NOW, { version: 2 })],
      `Signing off as ${ANN}.`,
    ],
  ])('offers "Sign off" when not mine (%s)', (_name, reviewer, signoffs, line) => {
    const markup = box(signoffs, reviewer)
    const button = [...signButton, 'aria-label="Sign off: Blue circle, square"']
    expect(hasTag(markup, 'button', button)).toBe(true)
    const sign = tags(markup, 'button').find((found) => found.includes(' name="one"')) ?? ''
    expect(sign.toLowerCase()).toContain(' formnovalidate=""')
    expect(text(markup)).toContain(`Sign off ${line} Signed off by`)
    expect(markup).not.toContain('Signed off by you.')
  })

  it('shows the tick and "Signed off by you." when mine', () => {
    const markup = box([signoff(1, ANN)], ANN)
    expect(markup).not.toContain('name="one"')
    expect(hasTag(markup, 'svg', ['aria-hidden="true"'])).toBe(true)
    expect(text(markup)).toContain('Signed off by you. Signed off by')
  })

  it('holds the expiry sentence in place of the picture and offers no sign-off when expired', () => {
    const markup = box([], ANN, variant({ expired: true }))
    expect(markup).not.toContain('<img')
    expect(markup).not.toContain('name="one"')
    expect(text(markup).split(EXPIRED)).toHaveLength(2)
    expect(text(markup)).not.toContain('Signing off as')
  })

  it('lists each current sign-off oldest first, each with its own Remove form', () => {
    const later = signoff(1, 'bo@example.com', NOW + 60_000)
    const first = signoff(2, ANN, NOW)
    const old = signoff(3, 'old@example.com', NOW, { version: 2 })
    const other = signoff(4, 'cy@example.com', NOW, { variantKey: 'bbbb33' })
    const markup = box([later, first, old, other], null)
    const list = `Signed off by ${ANN} · ${formatDate(NOW)} Remove bo@example.com · ${formatDate(NOW + 60_000)} Remove`
    expect(text(markup)).toContain(list)
    expect(markup).not.toContain('old@example.com')
    expect(markup).not.toContain('cy@example.com')
    const actions = tags(markup, 'form').map((found) => found.match(/action="([^"]*)"/)?.[1])
    expect(actions).toEqual([first.id, later.id].map((id) => `/l/${SLUG}/signoffs/${id}/remove`))
    expect(tags(markup, 'form').every((found) => found.includes(' method="post"'))).toBe(true)
    expect(
      hasTag(markup, 'button', ['type="submit"', `aria-label="Remove sign-off by ${ANN}"`]),
    ).toBe(true)
  })

  it('says "No sign-offs yet." when there are none', () => {
    expect(text(box())).toContain('Signed off by No sign-offs yet.')
    expect(box()).toMatch(/<h3[^>]*>Signed off by<\/h3>/)
  })

  it('draws Previous and Next hidden, for the script to show', () => {
    const markup = box()
    expect(hasTag(markup, 'button', ['type="button"', 'data-step="-1"', 'hidden=""'])).toBe(true)
    expect(hasTag(markup, 'button', ['type="button"', 'data-step="1"', 'hidden=""'])).toBe(true)
    expect(text(markup).endsWith('Previous Next')).toBe(true)
  })
})

describe('visitor text is drawn only as escaped text [S-13]', () => {
  const HOSTILE = `<script>alert(1)</script>"'&</style>`
  const ESCAPED = '&lt;script&gt;alert(1)&lt;/script&gt;&quot;&#x27;&amp;&lt;/style&gt;'
  it.each([
    ['title', box([], null, variant({ title: HOSTILE }))],
    ['size line', box([], null, variant({ sizeLine: HOSTILE }))],
    ['sign-off email', box([signoff(1, HOSTILE)], null)],
    ['reviewer email', box([], HOSTILE)],
    [
      'card button title',
      html(<CardSignoff slug={SLUG} variantKey={KEY} version={3} title={HOSTILE} />),
    ],
  ])('escapes a %s', (_name, markup) => {
    expect(markup).not.toContain('<script')
    expect(markup).not.toContain('</style>')
    expect(markup).toContain(ESCAPED)
  })

  it('builds every address from the slug, the variant key, the version and the sign-off id', () => {
    const markup = box([signoff(1, HOSTILE)], HOSTILE, variant({ title: HOSTILE }))
    const addresses = [...markup.matchAll(/\s(?:src|action|formaction)="([^"]*)"/gi)].map(
      (m) => m[1],
    )
    expect(addresses).toEqual([
      `/l/${SLUG}/p/${KEY}/3`,
      `/l/${SLUG}/signoffs/${signoff(1, '').id}/remove`,
    ])
  })
})
