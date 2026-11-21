import { beforeEach, describe, it, expect } from 'vitest'
import { putVariant } from '../src/db/variants'
import { openGallery } from '../src/visitor/actions'
import { NOTICES, noticeOn, type NoticePage } from '../src/visitor/notices'
import { addLink, clearTables, db, enter, makeApp } from './visitor-setup'

// spec/approvals-service.md "Notices": `m` becomes a key only through the fixed table.
describe('the notices table [approvals-service.md "Notices"]', () => {
  it('holds exactly the five notices, each on its one page, with the spec text', () => {
    expect(NOTICES).toEqual({
      'wrong-password': {
        page: 'password',
        text: 'That password did not work. If you have tried many times, wait 15 minutes and try again.',
      },
      signed: { page: 'gallery', text: 'Your sign-off was saved.' },
      removed: { page: 'gallery', text: 'The sign-off was removed.' },
      changed: {
        page: 'gallery',
        text: 'This variant changed while you were looking. Look at it again, and sign off if you still approve.',
      },
      'bad-email': { page: 'gallery', text: 'Enter a full email address, like name@company.com.' },
    })
  })

  const ROWS: [string | null, NoticePage, string | null][] = [
    ['wrong-password', 'password', 'wrong-password'],
    ['signed', 'gallery', 'signed'],
    ['removed', 'gallery', 'removed'],
    ['changed', 'gallery', 'changed'],
    ['bad-email', 'gallery', 'bad-email'],
    ['signed', 'password', null],
    ['wrong-password', 'gallery', null],
    [null, 'password', null],
    [null, 'gallery', null],
    ['', 'gallery', null],
    ['Signed', 'gallery', null],
    [' signed', 'gallery', null],
    ['signed ', 'gallery', null],
    ['<script>alert(1)</script>', 'gallery', null],
    ['__proto__', 'gallery', null],
    ['toString', 'password', null],
    ['constructor', 'gallery', null],
    ['hasOwnProperty', 'gallery', null],
  ]

  it.each(ROWS)('m=%j on the %s page gives %j', (m, page, expected) => {
    expect(noticeOn(page, m)).toBe(expected)
  })
})

const NOW = Date.UTC(2026, 10, 21, 12, 0)

// spec/approvals-service.md "The gallery view": openGallery takes what a page has.
const WIRING =
  'openGallery wires m only through the table [approvals-service.md "The gallery view"]'
describe(WIRING, () => {
  beforeEach(clearTables)

  async function setup() {
    const app = makeApp(() => NOW)
    const link = await addLink(1, 'Secret Campaign')
    const cookie = await enter(app, link.slug)
    return { link, cookie }
  }

  const M: (string | null)[] = [
    'wrong-password',
    'signed',
    'removed',
    'changed',
    'bad-email',
    null,
    '',
    '<b>zzqq</b>',
    '__proto__',
    'constructor',
  ]

  it.each(M)('gives the password result the password notice only, for m=%j', async (m) => {
    const { link } = await setup()
    const result = await openGallery(db, { slug: link.slug, cookie: null, m }, NOW)
    expect(result).toEqual({ kind: 'password', notice: noticeOn('password', m) })
    expect(result).toEqual({
      kind: 'password',
      notice: m === 'wrong-password' ? 'wrong-password' : null,
    })
  })

  it.each(M)('gives the gallery view the gallery notices only, for m=%j', async (m) => {
    const { link, cookie } = await setup()
    const result = await openGallery(db, { slug: link.slug, cookie, m }, NOW)
    if (result.kind !== 'gallery') throw new Error('no gallery')
    const shown = m !== null && m !== 'wrong-password' && Object.hasOwn(NOTICES, m) ? m : null
    expect(result.view.notice).toBe(shown)
    expect(JSON.stringify(result)).not.toContain('zzqq')
  })

  it('keeps exactly the four view fields and the six variant fields', async () => {
    const { link, cookie } = await setup()
    await putVariant(db, link.id, {
      variantKey: 'aaa234',
      position: 0,
      title: 'T',
      sizeLine: 'S',
      version: 1,
      pictureUrl: 'https://h.example/p.png',
      pictureExpiresAt: NOW + 1,
    }).run()
    const result = await openGallery(db, { slug: link.slug, cookie, m: null }, NOW)
    expect(Object.keys(result).sort()).toEqual(['kind', 'view'])
    if (result.kind !== 'gallery') throw new Error('no gallery')
    expect(Object.keys(result.view).sort()).toEqual(['link', 'notice', 'signoffs', 'variants'])
    expect(Object.keys(result.view.link).sort()).toEqual(['campaignName', 'slug'])
    expect(Object.keys(result.view.variants[0] ?? {}).sort()).toEqual([
      'expired',
      'position',
      'sizeLine',
      'title',
      'variantKey',
      'version',
    ])
  })

  it('gives a real slug with no session the same result as an unknown slug', async () => {
    const { link, cookie } = await setup()
    const wrongCookie = `__Host-adman-${link.slug}=${'A'.repeat(43)}`
    const real = await openGallery(db, { slug: link.slug, cookie: wrongCookie, m: null }, NOW)
    const unknown = await openGallery(db, { slug: 'zzzzzzzzzzzz', cookie, m: null }, NOW)
    expect(real).toEqual({ kind: 'password', notice: null })
    expect(unknown).toEqual(real)
    expect(JSON.stringify(real)).not.toContain('Secret Campaign')
  })
})
