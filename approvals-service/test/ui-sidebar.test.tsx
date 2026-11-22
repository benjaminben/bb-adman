import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ComponentProps, ReactElement } from 'react'
import { LogOutForm } from '../src/ui/log-out-form/log-out-form'
import { ReviewerForm } from '../src/ui/reviewer-form/reviewer-form'
import { ReviewerPanel } from '../src/ui/reviewer-panel/reviewer-panel'
import { SignoffAll } from '../src/ui/signoff-all/signoff-all'

// spec/phases/round-2-approvals.md "The sidebar (item 20)", "Sign off all" and S-13 (R2A-5): the
// sidebar parts drawn to static markup, as the server sends them.
const html = (element: ReactElement) => renderToStaticMarkup(element)
const SLUG = 'abcdEFGH2345'
const STAMP = 'f'.repeat(64)

type PanelProps = ComponentProps<typeof ReviewerPanel>
const panel = (extra: Partial<PanelProps> = {}) =>
  html(
    <ReviewerPanel
      slug={SLUG}
      campaignName="Spring shapes"
      reviewer={null}
      stamp={STAMP}
      notice={null}
      left={2}
      live={3}
      {...extra}
    />,
  )

// Every <tag ...> in the markup, as its attribute text.
const tags = (markup: string, tag: string) =>
  [...markup.matchAll(new RegExp(`<${tag}(\\s[^>]*)?>`, 'g'))].map((m) => ` ${m[1] ?? ''}`)

// True when some <tag> in the markup holds every given attribute, in any order.
const hasTag = (markup: string, tag: string, attrs: string[]) =>
  tags(markup, tag).some((found) => attrs.every((attr) => found.includes(` ${attr}`)))

// Everything a browser would show, without tags.
const text = (markup: string) =>
  markup
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const INSTRUCTIONS =
  'Look at each variant and sign off on the ones you approve. Your email is saved with each ' +
  'sign-off. Anyone with this link can see who signed off, and can remove a sign-off.'
const HINT = 'Used for every sign-off on this page. Kept until you log out or close the browser.'
const CONFIRM =
  'This signs off on every variant shown that you have not signed yet, as the email under ' +
  '“Signing off as:”. You can remove a sign-off later, one at a time.'

describe('the sidebar [round-2 "The sidebar"]', () => {
  it('is an aside named Review holding the h1, the instructions and the four parts in order', () => {
    const markup = panel()
    expect(hasTag(markup, 'aside', ['aria-label="Review"'])).toBe(true)
    expect(markup).toMatch(/<h1[^>]*>Spring shapes<\/h1>/)
    const shown = text(markup)
    expect(shown.startsWith(`Spring shapes ${INSTRUCTIONS} Signing off as: ${HINT}`)).toBe(true)
    const order = ['id="reviewer"', 'commandfor="confirm-all"', `action="/l/${SLUG}/leave"`]
    const at = order.map((piece) => markup.indexOf(piece))
    expect(at.every((n) => n > 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('draws a hostile campaign name and email only as escaped text [S-13]', () => {
    const HOSTILE = `<script>alert(1)</script>"'&</style>`
    const ESCAPED = '&lt;script&gt;alert(1)&lt;/script&gt;&quot;&#x27;&amp;&lt;/style&gt;'
    for (const markup of [panel({ campaignName: HOSTILE }), panel({ reviewer: HOSTILE })]) {
      expect(markup).not.toContain('<script')
      expect(markup).not.toContain('</style>')
      expect(markup).toContain(ESCAPED)
    }
    const actions = tags(panel({ reviewer: HOSTILE }), 'form').map(
      (t) => t.match(/action="([^"]*)"/)?.[1],
    )
    expect(actions).toEqual([`/l/${SLUG}/reviewer`, `/l/${SLUG}/leave`])
  })
})

describe('the reviewer form [round-2 "The sidebar" 3]', () => {
  const form = (extra: Partial<ComponentProps<typeof ReviewerForm>> = {}) =>
    html(<ReviewerForm slug={SLUG} reviewer={null} stamp={STAMP} notice={null} {...extra} />)

  it('posts to the reviewer route with a labelled email field, its hint and the stamp', () => {
    const markup = form()
    expect(
      hasTag(markup, 'form', ['id="reviewer"', 'method="post"', `action="/l/${SLUG}/reviewer"`]),
    ).toBe(true)
    expect(hasTag(markup, 'label', ['for="reviewer-email"'])).toBe(true)
    expect(markup).toMatch(/<label[^>]*>Signing off as:<\/label>/)
    const field = ['id="reviewer-email"', 'type="email"', 'name="email"', 'required=""']
    expect(hasTag(markup, 'input', [...field, 'aria-describedby="reviewer-hint"'])).toBe(true)
    expect(markup).toMatch(/<input[^>]*\sauto[cC]omplete="email"/)
    expect(markup).not.toContain('aria-invalid')
    expect(hasTag(markup, 'p', ['id="reviewer-hint"'])).toBe(true)
    expect(text(markup)).toBe(`Signing off as: ${HINT} Use this email`)
    expect(hasTag(markup, 'input', ['type="hidden"', 'name="seen"', `value="${STAMP}"`])).toBe(true)
    expect(hasTag(markup, 'input', ['id="reviewer-email"', 'value=""'])).toBe(true)
  })

  it('fills the field with the saved email', () => {
    const markup = form({ reviewer: 'ann@example.com' })
    expect(hasTag(markup, 'input', ['id="reviewer-email"', 'value="ann@example.com"'])).toBe(true)
  })

  it('has "Use this email" as its first submit button, with no name', () => {
    const buttons = tags(form(), 'button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).toContain(' type="submit"')
    expect(buttons[0]).not.toContain('name=')
    expect(form()).toMatch(/<button[^>]*>Use this email<\/button>/)
  })

  it('shows bad-email as an alert the field points to', () => {
    const markup = form({ notice: 'bad-email' })
    const words = 'Enter a full email address, like name@company.com.'
    expect(markup).toMatch(new RegExp(`<p[^>]*role="alert"[^>]*>${words}</p>`))
    expect(hasTag(markup, 'p', ['id="reviewer-error"', 'role="alert"'])).toBe(true)
    const field = [
      'id="reviewer-email"',
      'aria-invalid="true"',
      'aria-describedby="reviewer-hint reviewer-error"',
    ]
    expect(hasTag(markup, 'input', field)).toBe(true)
  })

  it('shows email-saved as a status, the field not invalid', () => {
    const markup = form({ notice: 'email-saved' })
    const words = 'Your email is saved until you log out or close the browser.'
    expect(markup).toMatch(new RegExp(`<p[^>]*role="status"[^>]*>${words}</p>`))
    expect(markup).not.toContain('aria-invalid')
    expect(markup).not.toContain('role="alert"')
  })

  it.each(['signed', 'removed', 'signed-all', 'gallery-changed', 'changed'] as const)(
    'leaves the %s notice to the main column',
    (notice) => {
      const markup = form({ notice })
      expect(markup).not.toContain('role=')
      expect(text(markup)).toBe(`Signing off as: ${HINT} Use this email`)
    },
  )
})

describe('"Sign off all" [round-2 "Sign off all"]', () => {
  const all = (reviewer: string | null, left: number, live: number) =>
    html(<SignoffAll slug={SLUG} reviewer={reviewer} left={left} live={live} />)
  const opener = (markup: string) => tags(markup, 'button')[0] ?? ''

  it('opens the confirmation with a full-width primary button', () => {
    const button = opener(all('ann@example.com', 2, 3))
    expect(button).toContain(' type="button"')
    expect(button).toContain(' commandfor="confirm-all"')
    expect(button).toContain(' command="show-modal"')
    expect(button).not.toContain('disabled')
    expect(all('ann@example.com', 2, 3)).toMatch(/<button[^>]*>Sign off all…<\/button>/)
  })

  it.each([
    ['an email, some left', 'ann@example.com', 2, 3, false, '2 left to sign off.'],
    ['an email, one left', 'ann@example.com', 1, 3, false, '1 left to sign off.'],
    ['an email, none left', 'ann@example.com', 0, 3, true, 'You have signed off on every variant.'],
    ['no email', null, 3, 3, false, 'Signs every variant shown, as the email above.'],
    ['no live variant, an email', 'ann@example.com', 0, 0, true, 'Nothing to sign off yet.'],
    ['no live variant, no email', null, 0, 0, true, 'Nothing to sign off yet.'],
  ])('with %s', (_name, reviewer, left, live, disabled, line) => {
    const markup = all(reviewer, left, live)
    expect(opener(markup).includes(' disabled=""')).toBe(disabled)
    expect(text(markup).startsWith(`Sign off all… ${line} Sign off all?`)).toBe(true)
  })

  it('confirms in a dialog whose submit signs all through the reviewer form', () => {
    const markup = all(null, 3, 3)
    expect(
      hasTag(markup, 'dialog', ['id="confirm-all"', 'aria-labelledby="confirm-all-title"']),
    ).toBe(true)
    expect(markup).toMatch(/<h2[^>]*id="confirm-all-title"[^>]*>Sign off all\?<\/h2>/)
    expect(text(markup).endsWith(`Sign off all? ${CONFIRM} Cancel Sign off all`)).toBe(true)
    const cancel = ['type="button"', 'commandfor="confirm-all"', 'command="close"', 'autofocus=""']
    expect(hasTag(markup, 'button', cancel)).toBe(true)
    const submit = ['type="submit"', 'form="reviewer"', 'name="all"', 'value="1"']
    expect(hasTag(markup, 'button', submit)).toBe(true)
    const signAll = tags(markup, 'button').find((found) => found.includes(' name="all"')) ?? ''
    expect(signAll.toLowerCase()).toContain(' formnovalidate=""')
  })
})

describe('"Log out" [round-2 "The sidebar" 5]', () => {
  it('posts to the leave route with one quiet button', () => {
    const markup = html(<LogOutForm slug={SLUG} />)
    expect(hasTag(markup, 'form', ['method="post"', `action="/l/${SLUG}/leave"`])).toBe(true)
    expect(tags(markup, 'button')).toHaveLength(1)
    expect(text(markup)).toBe('Log out')
  })
})
