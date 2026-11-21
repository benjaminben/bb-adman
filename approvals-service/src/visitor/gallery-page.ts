// spec/approvals-service.md "The pages": the gallery page. Every outside value goes through
// the html template; the picture src and form actions are built only from checked parts.
import { SignoffId, Slug, VariantKey } from '../contract'
import type { LinkRow } from '../db/links'
import type { SignoffRow } from '../db/signoffs'
import type { VariantRow } from '../db/variants'
import { documentOf, html } from './html'

export type GalleryData = {
  link: LinkRow
  variants: VariantRow[]
  signoffs: SignoffRow[]
  now: number
  // The address's `m`, looked up in the fixed table; its own text is never shown.
  m: string | null
}

const INTRO =
  'Sign off on a variant by entering your email address. Anyone with this link can see who ' +
  'signed off, and can remove a sign-off.'
const EXPIRED = 'This picture has expired. Ask the person who sent the link to update the gallery.'

const NOTICES = new Map([
  ['signed', 'Your sign-off was saved.'],
  ['removed', 'The sign-off was removed.'],
  [
    'changed',
    'This variant changed while you were looking. Look at it again, and sign off if you still ' +
      'approve.',
  ],
  ['bad-email', 'Enter a full email address, like name@company.com.'],
])

// A part going into an address must have its checked shape; anything else is a fault.
function checked(text: string, rule: { safeParse: (v: unknown) => { success: boolean } }) {
  if (!rule.safeParse(text).success) throw new TypeError('unchecked address part')
  return text
}

function wholeNumber(n: number): number {
  if (!Number.isSafeInteger(n) || n < 0) throw new TypeError('unchecked address part')
  return n
}

// YYYY-MM-DD HH:MM UTC
const dateOf = (ms: number) => `${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')} UTC`

function signoffList(slug: string, rows: SignoffRow[], earlier: boolean) {
  const items = rows.map(
    (row) =>
      html`<li>
        <span>${row.email} · ${dateOf(row.createdAt)}</span>
        <form method="post" action="/l/${slug}/signoffs/${checked(row.id, SignoffId)}/remove">
          <button type="submit">Remove</button>
        </form>
      </li>`,
  )
  return html`<ul class="${earlier ? 'signoffs earlier' : 'signoffs'}">
    ${items}
  </ul>`
}

function card(slug: string, row: VariantRow, signoffs: SignoffRow[], now: number) {
  const key = checked(row.variantKey, VariantKey)
  const version = wholeNumber(row.version)
  const current = signoffs.filter((s) => s.variantKey === key && s.version === version)
  const older = signoffs.filter((s) => s.variantKey === key && s.version !== version)
  const picture =
    row.pictureExpiresAt > now
      ? html`<img loading="lazy" alt="${row.title}" src="/l/${slug}/p/${key}/${version}" />`
      : html`<p class="expired">${EXPIRED}</p>`
  const signed =
    current.length > 0 ? signoffList(slug, current, false) : html`<p>No sign-offs yet.</p>`
  const earlier =
    older.length > 0
      ? html`<h3 class="earlier">For an earlier version</h3>
          ${signoffList(slug, older, true)}`
      : html``
  return html`<article class="card" id="v-${key}">
    ${picture}
    <h2>${row.title}</h2>
    <p class="size">${row.sizeLine}</p>
    <h3>Signed off by</h3>
    ${signed} ${earlier}
    <form class="sign" method="post" action="/l/${slug}/signoffs">
      <input type="hidden" name="variant" value="${key}" />
      <input type="hidden" name="version" value="${version}" />
      <input type="email" name="email" autocomplete="email" required aria-label="Email" />
      <button type="submit">Sign off</button>
    </form>
  </article>`
}

export function galleryPage(data: GalleryData) {
  const slug = checked(data.link.slug, Slug)
  const notice = NOTICES.get(data.m ?? '')
  const cards = data.variants.map((row) => card(slug, row, data.signoffs, data.now))
  return documentOf(
    data.link.campaignName,
    html`<h1>${data.link.campaignName}</h1>
      <div class="intro">
        <p>${INTRO}</p>
        <form method="post" action="/l/${slug}/leave">
          <button type="submit">Leave</button>
        </form>
      </div>
      ${notice === undefined ? html`` : html`<p class="notice" role="status">${notice}</p>`}
      ${cards.length > 0 ? html`<div class="grid">${cards}</div>` : html`<p>Nothing to review yet.</p>`}`,
  )
}
