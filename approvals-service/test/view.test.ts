import { beforeEach, describe, it, expect } from 'vitest'
import { addSignoff } from '../src/db/signoffs'
import { putVariant } from '../src/db/variants'
import { openGallery } from '../src/visitor/actions'
import { NOTICES, noticeOn, type NoticePage } from '../src/visitor/notices'
import { addLink, clearTables, db, enter, makeApp } from './visitor-setup'

// spec/approvals-service.md "Notices": `m` becomes a key only through the fixed table.
describe('the notices table [approvals-service.md "Notices"]', () => {
  it('holds exactly the six notices, each on its one page, with the spec text', () => {
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
      'email-saved': {
        page: 'gallery',
        text: 'Your email is saved until you log out or close the browser.',
      },
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
    expect(Object.keys(result.view).sort()).toEqual([
      'link',
      'notice',
      'reviewer',
      'signoffs',
      'variants',
    ])
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

// spec/phases/round-2-approvals.md "Security rules and the test that proves each": S-4, S-8.
describe('the view in Round 2 [round-2-approvals.md "Routes and data changes"]', () => {
  beforeEach(clearTables)

  const picture = { pictureUrl: 'https://h.example/p.png', pictureExpiresAt: NOW + 1 }
  const variantRow = (variantKey: string, position: number, version: number) => ({
    variantKey,
    position,
    title: 'T',
    sizeLine: 'S',
    version,
    ...picture,
  })
  const signoffRow = (n: number, variantKey: string, version: number) => ({
    id: `sign${n}`.padEnd(24, 'x'),
    variantKey,
    version,
    email: `person${n}@example.com`,
    createdAt: n,
  })

  it("holds only sign-offs of each variant's current version, of this link [S-8]", async () => {
    const app = makeApp(() => NOW)
    const link = await addLink(1)
    const other = await addLink(2)
    await putVariant(db, link.id, variantRow('aaa234', 0, 3)).run()
    await putVariant(db, link.id, variantRow('bbb234', 1, 4)).run()
    await putVariant(db, other.id, variantRow('aaa234', 0, 3)).run()
    const rows: [string, ReturnType<typeof signoffRow>][] = [
      [link.id, signoffRow(1, 'aaa234', 2)],
      [link.id, signoffRow(2, 'aaa234', 3)],
      [link.id, signoffRow(3, 'bbb234', 3)],
      [link.id, signoffRow(4, 'ccc234', 1)],
      [other.id, signoffRow(5, 'aaa234', 3)],
    ]
    for (const [linkId, row] of rows) await addSignoff(db, linkId, row).run()
    const cookie = await enter(app, link.slug)
    const result = await openGallery(db, { slug: link.slug, cookie, m: null }, NOW)
    if (result.kind !== 'gallery') throw new Error('no gallery')
    expect(result.view.signoffs).toEqual([signoffRow(2, 'aaa234', 3)])
    for (const n of [1, 3, 4, 5]) {
      expect(JSON.stringify(result)).not.toContain(`person${n}@example.com`)
    }
  })

  it('gives a variant edited after its sign-off none [S-8]', async () => {
    const app = makeApp(() => NOW)
    const link = await addLink(1)
    await putVariant(db, link.id, variantRow('aaa234', 0, 3)).run()
    await addSignoff(db, link.id, signoffRow(1, 'aaa234', 3)).run()
    await putVariant(db, link.id, variantRow('aaa234', 0, 4)).run()
    const cookie = await enter(app, link.slug)
    const result = await openGallery(db, { slug: link.slug, cookie, m: null }, NOW)
    if (result.kind !== 'gallery') throw new Error('no gallery')
    expect(result.view.signoffs).toEqual([])
  })

  it('ignores the reviewer cookie on the password page, real slug or unknown [S-4]', async () => {
    const link = await addLink(1, 'Secret Campaign')
    const reviewer = (slug: string) => `__Host-adman-${slug}-as=ann@example.com`
    const unknown = 'zzzzzzzzzzzz'
    const badSession = `__Host-adman-${link.slug}=${'A'.repeat(43)}`
    const asked: [string, string | null][] = [
      [link.slug, null],
      [link.slug, reviewer(link.slug)],
      [link.slug, `${badSession}; ${reviewer(link.slug)}`],
      [unknown, null],
      [unknown, reviewer(unknown)],
      [unknown, `${reviewer(link.slug)}; ${reviewer(unknown)}`],
    ]
    const results = new Set<string>()
    for (const [slug, cookie] of asked) {
      results.add(JSON.stringify(await openGallery(db, { slug, cookie, m: null }, NOW)))
    }
    expect([...results]).toEqual([JSON.stringify({ kind: 'password', notice: null })])
  })
})
