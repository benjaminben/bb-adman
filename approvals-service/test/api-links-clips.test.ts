import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import * as h from './api-helpers'

// spec/phases/round-2-approvals-video.md "Contract and data changes" and the security rules
// SV-5 and SV-9 (R2V-1): clip addresses are checked and stored like picture addresses.

const { app, call, linkPath, create, variant, putGallery, errorCode } = h

beforeEach(h.clearAll)
afterEach(() => vi.restoreAllMocks())

const clipUrl = (name: string) =>
  `https://my-bucket.s3.eu-west-1.amazonaws.com/${name}.mp4?X-Amz-Signature=clip-secret`

const clip = (name: string) => ({
  clipUrl: clipUrl(name),
  type: 'video/mp4',
  durationMs: 15_000,
  bytes: 2_000_000,
})

const video = (key: string, version = 1) => ({
  ...variant(key, version),
  kind: 'video',
  clip: clip(key),
})

const BAD_CLIP_URLS = [
  'http://my-bucket.s3.eu-west-1.amazonaws.com/c.mp4?X-Amz-Signature=clip-secret',
  'https://elsewhere.example/c.mp4?X-Amz-Signature=clip-secret',
  'https://user:pw@my-bucket.s3.eu-west-1.amazonaws.com/c.mp4?X-Amz-Signature=clip-secret',
  'https://my-bucket.s3.eu-west-1.amazonaws.com:8443/c.mp4?X-Amz-Signature=clip-secret',
]

async function storedRows(linkId: string) {
  const sql = `SELECT variant_key, kind, clip_url, clip_ms, clip_bytes, picture_url,
    picture_expires_at FROM gallery_variant WHERE link_id = ? ORDER BY position`
  return (await h.db.prepare(sql).bind(linkId).all()).results
}

const galleryPath = linkPath('spring-abc234') + '/gallery'
const picturesPath = linkPath('spring-abc234') + '/pictures'

describe('PUT .../gallery with clips [R2V-1, SV-5]', () => {
  it('stores the kind and the three clip columns; an image and a still-only video store nulls', async () => {
    await create('spring-abc234')
    const id = await h.linkIdOf('spring-abc234')
    const stillOnly = { ...variant('ccc234'), kind: 'video', clip: null }
    const reply = await putGallery('spring-abc234', [video('aaa234'), variant('bbb234'), stillOnly])
    expect(reply.status).toBe(200)
    expect(await reply.json()).toEqual({ variants: 3 })
    const rows = (await storedRows(id)).map((r) => ({ ...r, picture_url: undefined }))
    const empty = { kind: 'image', clip_url: null, clip_ms: null, clip_bytes: null }
    const times = {
      picture_url: undefined,
      picture_expires_at: Date.parse('2026-12-01T00:00:00.000Z'),
    }
    expect(rows).toEqual([
      {
        variant_key: 'aaa234',
        kind: 'video',
        clip_url: clipUrl('aaa234'),
        clip_ms: 15_000,
        clip_bytes: 2_000_000,
        ...times,
      },
      { variant_key: 'bbb234', ...empty, ...times },
      { variant_key: 'ccc234', ...empty, kind: 'video', ...times },
    ])
  })

  it('stores only the cleaned form of a clip address', async () => {
    await create('spring-abc234')
    const id = await h.linkIdOf('spring-abc234')
    const raw = 'https://MY-BUCKET.s3.eu-west-1.amazonaws.com:443/a b.mp4'
    const v = { ...video('aaa234'), clip: { ...clip('aaa234'), clipUrl: raw } }
    expect((await putGallery('spring-abc234', [v])).status).toBe(200)
    const [row] = await storedRows(id)
    expect(row?.clip_url).toBe('https://my-bucket.s3.eu-west-1.amazonaws.com/a%20b.mp4')
  })

  it('refuses an image variant with a clip with 400 and writes nothing', async () => {
    await create('spring-abc234')
    const id = await h.linkIdOf('spring-abc234')
    await putGallery('spring-abc234', [variant('aaa234')])
    const before = await storedRows(id)
    const wrong = { ...video('bbb234'), kind: 'image' }
    const reply = await putGallery('spring-abc234', [variant('aaa234'), wrong])
    expect(reply.status).toBe(400)
    expect(await errorCode(reply)).toBe('invalid_input')
    expect(await storedRows(id)).toEqual(before)
  })

  it.each(BAD_CLIP_URLS)('refuses the whole body for a bad clip address %#', async (bad) => {
    const logged: unknown[][] = []
    vi.spyOn(console, 'error').mockImplementation((...args) => void logged.push(args))
    await create('spring-abc234')
    const id = await h.linkIdOf('spring-abc234')
    await putGallery('spring-abc234', [variant('aaa234')])
    const before = await storedRows(id)
    const v = { ...video('bbb234'), clip: { ...clip('bbb234'), clipUrl: bad } }
    const reply = await putGallery('spring-abc234', [video('aaa234', 2), v], 'Spring 2')
    expect(reply.status).toBe(400)
    const text = await reply.text()
    expect(JSON.parse(text)).toMatchObject({ error: { code: 'invalid_input' } })
    expect(text).not.toContain('clip-secret')
    expect(JSON.stringify(logged)).not.toContain('clip-secret')
    expect(await storedRows(id)).toEqual(before)
    const name = 'SELECT campaign_name FROM link WHERE id = ?'
    expect(await h.db.prepare(name).bind(id).first('campaign_name')).toBe('Spring')
  })
})

const renewal = (key: string, version: number, clipName: string | null) => ({
  variantKey: key,
  version,
  pictureUrl: h.picture(`${key}-new`),
  pictureExpiresAt: '2026-12-08T00:00:00.000Z',
  clipUrl: clipName === null ? null : clipUrl(clipName),
})

const renew = (pictures: unknown[]) => app().fetch(call('PUT', picturesPath, { pictures }))

describe('PUT .../pictures with clips [R2V-1, SV-5, SV-9]', () => {
  async function setUp() {
    await create('spring-abc234')
    await putGallery('spring-abc234', [video('aaa234'), variant('bbb234')])
    return h.linkIdOf('spring-abc234')
  }

  it('renews the picture and the clip of a row with a clip together', async () => {
    const id = await setUp()
    const reply = await renew([renewal('aaa234', 1, 'aaa234-new'), renewal('bbb234', 1, null)])
    expect(await reply.json()).toEqual({ renewed: 2 })
    const [a, b] = await storedRows(id)
    const expires = Date.parse('2026-12-08T00:00:00.000Z')
    expect(a).toMatchObject({
      clip_url: clipUrl('aaa234-new'),
      picture_url: h.picture('aaa234-new'),
    })
    expect([a?.picture_expires_at, b?.picture_expires_at]).toEqual([expires, expires])
    expect(b).toMatchObject({ clip_url: null, picture_url: h.picture('bbb234-new') })
  })

  it('counts 0 and changes nothing when a renewal leaves out the clip of a row with one', async () => {
    const id = await setUp()
    const before = await storedRows(id)
    expect(await (await renew([renewal('aaa234', 1, null)])).json()).toEqual({ renewed: 0 })
    expect(await storedRows(id)).toEqual(before)
  })

  it('counts 0 and changes nothing when a renewal sends a clip for a row without one', async () => {
    const id = await setUp()
    const before = await storedRows(id)
    expect(await (await renew([renewal('bbb234', 1, 'bbb234')])).json()).toEqual({ renewed: 0 })
    expect(await storedRows(id)).toEqual(before)
  })

  it('reads a renewal without clipUrl as clipUrl null', async () => {
    const id = await setUp()
    const picture: Record<string, unknown> = renewal('bbb234', 1, null)
    delete picture.clipUrl
    expect(await (await renew([picture])).json()).toEqual({ renewed: 1 })
    expect((await storedRows(id))[1]).toMatchObject({ picture_url: h.picture('bbb234-new') })
  })

  it.each(BAD_CLIP_URLS)('refuses the whole renewal for a bad clip address %#', async (bad) => {
    const id = await setUp()
    const before = await storedRows(id)
    const reply = await renew([
      renewal('bbb234', 1, null),
      { ...renewal('aaa234', 1, null), clipUrl: bad },
    ])
    expect(reply.status).toBe(400)
    expect(await reply.text()).not.toContain('clip-secret')
    expect(await storedRows(id)).toEqual(before)
  })
})

describe('the API body limit is 4 MiB [R2V-1]', () => {
  const MiB = 1024 * 1024
  // A valid gallery body padded with spaces (still JSON) to exactly `size` bytes.
  function bodyOf(size: number): Request {
    const text = JSON.stringify({ campaignName: 'Spring', variants: [video('aaa234')] })
    return new Request(call('PUT', galleryPath).url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${h.KEY}`, 'Content-Type': 'application/json' },
      body: text + ' '.repeat(size - new TextEncoder().encode(text).byteLength),
    })
  }

  it.each([
    ['3 MiB', 3 * MiB, 200],
    ['exactly 4 MiB', 4 * MiB, 200],
    ['4 MiB plus one byte', 4 * MiB + 1, 413],
  ])('a body of %s (%i bytes) answers %i', async (_name, size, status) => {
    await create('spring-abc234')
    expect((await app().fetch(bodyOf(size))).status).toBe(status)
  })
})
