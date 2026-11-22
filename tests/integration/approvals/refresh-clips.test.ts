// R2V-3 (spec/phases/round-2-approvals-video.md "Renewal", SV-9): approvals.refresh signs a
// due row's clip again with its still and sends both, with the earlier of the two expiries; a
// row without a clip sends clipUrl null. A service row whose clip the renewal leaves out is not
// renewed, and a stored row with clip numbers out of range is skipped and logged without
// values. Kept apart from refresh.test.ts so each file stays under 300 lines.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readVariants } from '@/main/approvals/local-store'
import { clipPath, picturePath } from '@/shared/approvals/picture-paths'
import { data } from '../core-fixture'
import {
  addVariants,
  makeLinkFixture,
  pair,
  setUp,
  stubDraw,
  variantsOf,
  type LinkFixture,
} from './link-fixture'

const DAY = 86_400_000
let lf: LinkFixture

beforeEach(async () => {
  lf = await makeLinkFixture()
  await setUp(lf)
  data(await lf.f.user('approvals.createLink', pair(lf)))
})
afterEach(() => {
  vi.restoreAllMocks()
  return lf.close()
})

const refresh = () => lf.f.user('approvals.refresh', pair(lf))
const rows = () => readVariants(lf.db(), lf.c1, lf.f.core.deps.log)
const rowOf = (id: string) => rows().find((r) => r.variantId === id)!
const link = () => lf.stand.links.get(`${lf.projectId}/${lf.c1}`)

async function published(extra: number): Promise<string[]> {
  addVariants(lf, lf.c1, extra)
  stubDraw(lf)
  data(await lf.f.user('approvals.publish', pair(lf)))
  return variantsOf(lf).map((v) => v.id)
}

const update = (sql: string, ...values: unknown[]) =>
  lf
    .db()
    .prepare(`UPDATE approval_variant SET ${sql} WHERE campaign_id = ? AND variant_id = ?`)
    .run(...values)
const dueSoon = (id: string) =>
  update('expires_at = ?', new Date(Date.now() + DAY).toISOString(), lf.c1, id)
const setClip = (id: string, ms: unknown, bytes: unknown, missing: unknown = null) =>
  update('clip_ms = ?, clip_bytes = ?, clip_missing = ?', ms, bytes, missing, lf.c1, id)

type Sent = { variantKey: string; pictureUrl: string; pictureExpiresAt: string; clipUrl: unknown }
const renewals = () =>
  lf.stand.seen
    .filter((s) => s.route === 'renewPictures')
    .map((s) => (JSON.parse(s.body) as { pictures: Sent[] }).pictures)

// The stand-in's gallery row made a video with a clip, as R2V-5 will send it.
function clipOnService(id: string) {
  const row = link()!.gallery.find((v) => v.variantKey === id)!
  const clip = { clipUrl: 'http://127.0.0.1:1/old.mp4', type: 'video/mp4', durationMs: 8000 }
  Object.assign(row, { kind: 'video', clip: { ...clip, bytes: 4096 } })
  return row
}

describe('approvals.refresh renews clips [R2V-3, SV-9]', () => {
  it('signs and sends the clip of a due row with one, with the earlier of the two expiries', async () => {
    const [video = '', image = ''] = await published(1)
    for (const id of [video, image]) dueSoon(id)
    setClip(video, 8000, 4096)
    const row = clipOnService(video)
    const real = lf.f.core.deps.approvals.pictures()
    const early = new Date(Date.now() + 5 * DAY).toISOString()
    vi.spyOn(lf.f.core.deps.approvals, 'pictures').mockReturnValue({
      ...real,
      signedUrl: async (p, s) => {
        const signed = await real.signedUrl(p, s)
        return p.endsWith('.mp4') ? { ...signed, expiresAt: early } : signed
      },
    })
    const address = (file: string) => `${lf.stand.origin}/${file}`
    const rev = (id: string) => rowOf(id).publishedRev
    const clipUrl = address(clipPath(lf.projectId, lf.c1, video, rev(video)))
    const still = (id: string) => address(picturePath(lf.projectId, lf.c1, id, rev(id)))
    data(await refresh())
    const [sent = []] = renewals()
    expect(sent.find((p) => p.variantKey === video)).toMatchObject({
      pictureUrl: still(video),
      pictureExpiresAt: early,
      clipUrl,
    })
    expect(sent.find((p) => p.variantKey === image)).toMatchObject({
      pictureUrl: still(image),
      clipUrl: null,
    })
    expect(rowOf(video).expiresAt).toBe(early)
    expect(rowOf(video)).toMatchObject({ clipMs: 8000, clipBytes: 4096, clipMissing: null })
    expect(row.clip?.clipUrl).toBe(clipUrl)
    expect(lf.f.readLogs()).not.toContain('.mp4')
  })

  it('renews nothing when the service holds a clip the row does not know of', async () => {
    const [id = ''] = await published(0)
    dueSoon(id)
    clipOnService(id)
    const was = rows()
    data(await refresh())
    expect(renewals()[0]?.map((p) => p.clipUrl)).toEqual([null])
    expect(rows()).toEqual(was)
    expect(lf.f.readLogs()).toContain('refreshRenew')
  })

  it.each([
    ['a length over 3 minutes', 180_001, 4096, null],
    ['a size over 384 MiB', 8000, 987_654_321, null],
    ['a length of 0', 0, 4096, null],
    ['a length without a size', 8000, null, null],
    ['a size without a length', null, 4096, null],
    ['a fraction', 8000.5, 4096, null],
    ['a reason beside the numbers', 8000, 4096, 'too_long'],
    ['an unknown reason', null, null, 'too_slow'],
  ])(
    'skips a row with %s, logs it without values and renews nothing',
    async (_n, ms, bytes, why) => {
      const [id = ''] = await published(0)
      dueSoon(id)
      setClip(id, ms, bytes, why)
      data(await refresh())
      expect(rows()).toEqual([])
      expect(renewals()).toEqual([])
      const logs = lf.f.readLogs()
      expect(logs).toContain('approval_variant')
      for (const value of [ms, bytes, why]) {
        if (value !== null && String(value).length > 3) expect(logs).not.toContain(String(value))
      }
    },
  )
})
