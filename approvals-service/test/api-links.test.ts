import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { addSession } from '../src/db/sessions'
import { addSignoff } from '../src/db/signoffs'
import { LinkState } from '../src/contract'
import * as h from './api-helpers'

const { app, call, linkPath, picture } = h
const PASSWORD = 'correct horse battery'
const TIME = '2026-12-08T00:00:00.000Z'
const BAD = 'invalid_input'

async function create(campaignId: string, over = {}) {
  const body = { projectId: h.PROJECT, campaignId, campaignName: 'Spring', password: PASSWORD }
  return app(over).fetch(call('POST', '/links', body))
}

function variant(variantKey: string, version = 1) {
  return {
    variantKey,
    title: `Title ${variantKey}`,
    sizeLine: '1080 × 1080',
    version,
    pictureUrl: picture(variantKey),
    pictureExpiresAt: '2026-12-01T00:00:00.000Z',
  }
}

const putGallery = (campaignId: string, variants: unknown[], campaignName = 'Spring') =>
  app().fetch(call('PUT', `${linkPath(campaignId)}/gallery`, { campaignName, variants }))

async function signoff(linkId: string, n: number, variantKey: string, version: number) {
  const row = { id: `s${n}`.padEnd(24, 'x'), variantKey, version, email: `p${n}@a.co` }
  await addSignoff(h.db, linkId, { ...row, createdAt: h.NOW + n }).run()
}

const errorCode = async (reply: Response) =>
  (await reply.json<{ error: { code: string } }>()).error.code

beforeEach(h.clearAll)
afterEach(() => vi.restoreAllMocks())

describe('POST /api/v1/links', () => {
  it('makes a link and answers 201 with its slug only', async () => {
    const reply = await create('spring-abc234')
    expect(reply.status).toBe(201)
    const body = await reply.json<{ slug: string }>()
    expect(Object.keys(body)).toEqual(['slug'])
    expect(body.slug).toMatch(/^[0-9A-Za-z]{12}$/)
    const row = await h.db
      .prepare('SELECT * FROM link WHERE slug = ?')
      .bind(body.slug)
      .first<Record<string, unknown>>()
    expect(row?.campaign_name).toBe('Spring')
    expect(row?.created_at).toBe(h.NOW)
    expect(row?.id).toMatch(/^[0-9A-Za-z]{24}$/)
    expect(JSON.stringify(row)).not.toContain(PASSWORD)
  })

  it('answers 409 link_exists when the pair already has a link', async () => {
    await create('spring-abc234')
    const reply = await create('spring-abc234')
    expect(reply.status).toBe(409)
    expect(await errorCode(reply)).toBe('link_exists')
  })

  it('answers 500 after three slug clashes and logs only names', async () => {
    const logged: unknown[][] = []
    vi.spyOn(console, 'error').mockImplementation((...args) => void logged.push(args))
    const zeros = { random: (n: number) => new Uint8Array(n) }
    expect((await create('spring-abc234', zeros)).status).toBe(201)
    const reply = await create('autumn-abc234', zeros)
    expect(reply.status).toBe(500)
    expect(await errorCode(reply)).toBe('internal')
    expect(logged).toEqual([['create-link', 'Error']])
  })
})

describe('GET /api/v1/links/{projectId}/{campaignId}', () => {
  it('answers the LinkState: gallery order, sign-offs oldest first, no picture address', async () => {
    const { slug } = await (await create('spring-abc234')).json<{ slug: string }>()
    await putGallery('spring-abc234', [variant('bbb234', 2), variant('aaa234')])
    const id = await h.linkIdOf('spring-abc234')
    await signoff(id, 2, 'aaa234', 1)
    await signoff(id, 1, 'bbb234', 1)
    const reply = await app().fetch(call('GET', linkPath('spring-abc234')))
    expect(reply.status).toBe(200)
    const text = await reply.text()
    expect(JSON.parse(text)).toEqual({
      slug,
      campaignName: 'Spring',
      createdAt: new Date(h.NOW).toISOString(),
      variants: [
        { variantKey: 'bbb234', version: 2, pictureExpiresAt: '2026-12-01T00:00:00.000Z' },
        { variantKey: 'aaa234', version: 1, pictureExpiresAt: '2026-12-01T00:00:00.000Z' },
      ],
      signoffs: [1, 2].map((n) => ({
        id: `s${n}`.padEnd(24, 'x'),
        variantKey: n === 1 ? 'bbb234' : 'aaa234',
        version: 1,
        email: `p${n}@a.co`,
        signedAt: new Date(h.NOW + n).toISOString(),
      })),
    })
    expect(LinkState.safeParse(JSON.parse(text)).success).toBe(true)
    for (const secret of ['amazonaws', 'Signature', id, 'hash', 'salt']) {
      expect(text).not.toContain(secret)
    }
  })

  it('answers 404 not_found when the pair has no link', async () => {
    const reply = await app().fetch(call('GET', linkPath('spring-abc234')))
    expect(reply.status).toBe(404)
    expect(await errorCode(reply)).toBe('not_found')
  })
})

describe('PUT .../password', () => {
  it('sets a new salt and hash, resets tries and deletes every session of the link', async () => {
    await create('spring-abc234')
    await create('autumn-abc234')
    const [id, other] = [await h.linkIdOf('spring-abc234'), await h.linkIdOf('autumn-abc234')]
    await h.db.prepare('UPDATE link SET tries = 5, tries_since = 1').run()
    for (const [n, linkId] of [id, id, other].entries()) {
      await addSession(h.db, { tokenHash: `t${n}`, linkId, expiresAt: h.NOW * 2 }).run()
    }
    const read = 'SELECT password_hash, password_salt, tries, tries_since FROM link WHERE id = ?'
    const before = await h.db.prepare(read).bind(id).first<Record<string, unknown>>()
    const body = { password: 'another long password' }
    const reply = await app().fetch(call('PUT', `${linkPath('spring-abc234')}/password`, body))
    expect(reply.status).toBe(200)
    expect(await reply.json()).toEqual({})
    const after = await h.db.prepare(read).bind(id).first<Record<string, unknown>>()
    expect(after?.password_hash).not.toBe(before?.password_hash)
    expect(after?.password_salt).not.toBe(before?.password_salt)
    expect([after?.tries, after?.tries_since]).toEqual([0, null])
    expect(await h.countFor('session', id)).toBe(0)
    expect(await h.countFor('session', other)).toBe(1)
  })
})

describe('PUT .../gallery', () => {
  it('writes the list in order, removes unlisted variants with their sign-offs, keeps older-version sign-offs', async () => {
    await create('spring-abc234')
    const id = await h.linkIdOf('spring-abc234')
    await putGallery('spring-abc234', [variant('aaa234'), variant('bbb234'), variant('ccc234')])
    await signoff(id, 1, 'aaa234', 1)
    await signoff(id, 2, 'bbb234', 1)
    const reply = await putGallery(
      'spring-abc234',
      [variant('ccc234'), variant('aaa234', 2)],
      'Spring 2',
    )
    expect(reply.status).toBe(200)
    expect(await reply.json()).toEqual({ variants: 2 })
    const rows = await h.db
      .prepare('SELECT variant_key, position, version FROM gallery_variant WHERE link_id = ?')
      .bind(id)
      .all()
    expect(rows.results).toEqual([
      { variant_key: 'aaa234', position: 1, version: 2 },
      { variant_key: 'ccc234', position: 0, version: 1 },
    ])
    const kept = await h.db.prepare('SELECT variant_key, version FROM signoff').all()
    expect(kept.results).toEqual([{ variant_key: 'aaa234', version: 1 }])
    const name = 'SELECT campaign_name FROM link WHERE id = ?'
    expect(await h.db.prepare(name).bind(id).first('campaign_name')).toBe('Spring 2')
  })

  it('accepts the test picture origin only when TEST_PICTURE_ORIGIN allows it', async () => {
    await create('spring-abc234')
    const local = { ...variant('aaa234'), pictureUrl: 'http://127.0.0.1:8787/a.png' }
    const body = { campaignName: 'Spring', variants: [local] }
    const path = `${linkPath('spring-abc234')}/gallery`
    expect((await app().fetch(call('PUT', path, body))).status).toBe(400)
    const allowed = app({}, 'http://127.0.0.1:8787')
    expect((await allowed.fetch(call('PUT', path, body))).status).toBe(200)
  })
})

describe('PUT .../pictures', () => {
  it('renews only rows whose variant and version both match, and never changes a version', async () => {
    await create('spring-abc234')
    const id = await h.linkIdOf('spring-abc234')
    await putGallery('spring-abc234', [variant('aaa234'), variant('bbb234', 3)])
    const renewal = (variantKey: string, version: number) => ({
      variantKey,
      version,
      pictureUrl: picture(`${variantKey}-new`),
      pictureExpiresAt: '2026-12-08T00:00:00.000Z',
    })
    const pictures = [renewal('aaa234', 1), renewal('bbb234', 2), renewal('zzz234', 1)]
    const path = `${linkPath('spring-abc234')}/pictures`
    const reply = await app().fetch(call('PUT', path, { pictures }))
    expect(reply.status).toBe(200)
    expect(await reply.json()).toEqual({ renewed: 1 })
    const rows = await h.db
      .prepare(
        `SELECT variant_key, version, picture_url, picture_expires_at FROM gallery_variant
          WHERE link_id = ? ORDER BY position`,
      )
      .bind(id)
      .all()
    expect(rows.results).toEqual([
      {
        variant_key: 'aaa234',
        version: 1,
        picture_url: picture('aaa234-new'),
        picture_expires_at: Date.parse('2026-12-08T00:00:00.000Z'),
      },
      {
        variant_key: 'bbb234',
        version: 3,
        picture_url: picture('bbb234'),
        picture_expires_at: Date.parse('2026-12-01T00:00:00.000Z'),
      },
    ])
  })
})

describe('DELETE /api/v1/links/{projectId}/{campaignId}', () => {
  it('empties every table for the link and leaves another link untouched', async () => {
    for (const [n, c] of ['spring-abc234', 'autumn-abc234'].entries()) {
      await create(c)
      await putGallery(c, [variant('aaa234')])
      const id = await h.linkIdOf(c)
      await signoff(id, n, 'aaa234', 1)
      await addSession(h.db, { tokenHash: `t-${id}`, linkId: id, expiresAt: h.NOW * 2 }).run()
    }
    const [id, other] = [await h.linkIdOf('spring-abc234'), await h.linkIdOf('autumn-abc234')]
    const reply = await app().fetch(call('DELETE', linkPath('spring-abc234')))
    expect(reply.status).toBe(200)
    expect(await reply.json()).toEqual({})
    const tables = ['link', 'gallery_variant', 'signoff', 'session']
    for (const t of tables) expect(await h.countFor(t, id), t).toBe(0)
    for (const t of tables) expect(await h.countFor(t, other), t).toBe(1)
  })
})

describe('a link route naming another campaign, or a bad picture address', () => {
  const renewal = (pictureUrl: string) => ({
    pictures: [{ variantKey: 'aaa234', version: 1, pictureUrl, pictureExpiresAt: TIME }],
  })
  const gallery = (pictureUrl: string) => ({
    campaignName: 'Hacked',
    variants: [{ ...variant('aaa234'), pictureUrl }],
  })
  const other = linkPath('winter-abc234')
  const own = linkPath('spring-abc234')
  const good = picture('new')
  const bad = 'https://evil.example/a.png'

  const rows: [string, () => Request, number, string][] = [
    ['read', () => call('GET', other), 404, 'not_found'],
    ['password', () => call('PUT', `${other}/password`, { password: PASSWORD }), 404, 'not_found'],
    ['gallery', () => call('PUT', `${other}/gallery`, gallery(good)), 404, 'not_found'],
    ['pictures', () => call('PUT', `${other}/pictures`, renewal(good)), 404, 'not_found'],
    ['delete', () => call('DELETE', other), 404, 'not_found'],
    ['a bad gallery address', () => call('PUT', `${own}/gallery`, gallery(bad)), 400, BAD],
    ['a bad renewal address', () => call('PUT', `${own}/pictures`, renewal(bad)), 400, BAD],
  ]

  it.each(rows)('%s is refused and changes nothing', async (_name, request, status, code) => {
    await create('spring-abc234')
    await putGallery('spring-abc234', [variant('aaa234')])
    const all = async (t: string) => (await h.db.prepare(`SELECT * FROM ${t}`).all()).results
    const snapshot = () => Promise.all(['link', 'gallery_variant'].map(all))
    const before = await snapshot()
    const reply = await app().fetch(request())
    expect(reply.status).toBe(status)
    expect(await errorCode(reply)).toBe(code)
    expect(await snapshot()).toEqual(before)
  })
})
