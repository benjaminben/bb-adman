// approvals.publish, "Update gallery" (spec/approvals-commands.md "approvals.publish", security
// class): only changed variants drawn, each file named with the drawn rev, the gallery body,
// all or nothing on a failure at draw, upload, signing or the service, old files removed after
// success, over 500 variants refused, one approvals.changed. Requests go to the stand-in,
// pictures to the test store, and the draw is a stand-in.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readLink, readVariants } from '@/main/approvals/local-store'
import { TEST_PICTURES_FOLDER } from '@/main/approvals/test-picture-store'
import type { PictureStore } from '@/main/approvals/types'
import { ProviderFailure } from '@/main/providers/types'
import { picturePath } from '@/shared/approvals/picture-paths'
import { APPROVALS_REASON_MESSAGES, renderFailedMessage } from '@/shared/approvals/messages'
import { plainMessage } from '@/shared/providers/messages'
import { data } from '../core-fixture'
import {
  addVariants,
  bumpRev,
  makeLinkFixture,
  pair,
  setUp,
  stubDraw,
  variantsOf,
  type LinkFixture,
} from './link-fixture'

let lf: LinkFixture

beforeEach(async () => {
  lf = await makeLinkFixture()
  await setUp(lf)
  for (const c of [lf.c1, lf.c2]) data(await lf.f.user('approvals.createLink', pair(lf, c)))
})
afterEach(() => {
  vi.restoreAllMocks()
  return lf.close()
})

const publish = (campaignId = lf.c1) => lf.f.user('approvals.publish', pair(lf, campaignId))
const log = () => lf.f.core.deps.log
const root = () => path.join(lf.f.userData, TEST_PICTURES_FOLDER)
const fileOf = (variantId: string, rev: number, campaignId = lf.c1) =>
  picturePath(lf.projectId, campaignId, variantId, rev)
const onDisk = (rel: string) => fs.existsSync(path.join(root(), rel))
const gallery = (campaignId = lf.c1) =>
  lf.stand.links.get(`${lf.projectId}/${campaignId}`)?.gallery ?? []
const changedEvents = (from: number) =>
  lf.f.events.slice(from).filter((e) => e.name === 'approvals.changed')

// The real test store with one method failing as S3 fails, from its `after`-th call on.
function failingStore(method: 'put' | 'signedUrl' | 'list', after = 0): void {
  const real = lf.f.core.deps.approvals.pictures()
  let calls = 0
  const fail = () => {
    calls += 1
    if (calls > after) throw new ProviderFailure({ kind: 'offline', detail: 'stand-in' })
  }
  const store: PictureStore = {
    put: async (p, png) => (method === 'put' && fail(), real.put(p, png)),
    signedUrl: async (p, s) => (method === 'signedUrl' && fail(), real.signedUrl(p, s)),
    list: async (folder) => (method === 'list' && fail(), real.list(folder)),
    remove: (paths) => real.remove(paths),
  }
  vi.spyOn(lf.f.core.deps.approvals, 'pictures').mockReturnValue(store)
}

describe('approvals.publish [spec/approvals-commands.md "approvals.publish"]', () => {
  it('draws every variant the first time and sends the gallery body', async () => {
    addVariants(lf, lf.c1, 2)
    const draw = stubDraw(lf)
    const before = lf.f.events.length
    const variants = variantsOf(lf)
    expect(await publish()).toEqual({ ok: true, data: { variants: 3, drawn: 3 } })
    expect(draw).toHaveBeenCalledTimes(3)
    expect(draw.mock.calls.map((c) => c[2])).toEqual([1600, 1600, 1600])
    const sent = gallery()
    expect(sent.map((v) => v.variantKey)).toEqual(variants.map((v) => v.id))
    for (const [i, v] of variants.entries()) {
      expect(sent[i]).toEqual({
        variantKey: v.id,
        title: v.title,
        sizeLine: '1080×1080 · en · image',
        version: v.rev,
        pictureUrl: `${lf.stand.origin}/${fileOf(v.id, v.rev)}`,
        pictureExpiresAt: expect.any(String),
        kind: 'image',
        clip: null,
      })
      expect(onDisk(fileOf(v.id, v.rev))).toBe(true)
    }
    const body = JSON.parse(lf.stand.seen.filter((s) => s.route === 'replaceGallery')[0]!.body)
    expect(body.campaignName).toBe('Spring Sale')
    for (const v of body.variants) expect(v.clip ?? null).toBeNull()
    expect(readVariants(lf.db(), lf.c1, log())).toEqual(
      variants
        .map((v, i) => ({
          variantId: v.id,
          publishedRev: v.rev,
          expiresAt: sent[i]!.pictureExpiresAt,
        }))
        .sort((a, b) => (a.variantId < b.variantId ? -1 : 1)),
    )
    expect(readLink(lf.db(), lf.c1, log())?.publishedAt).toEqual(expect.any(String))
    expect(changedEvents(before)).toEqual([
      { name: 'approvals.changed', payload: { projectId: lf.projectId, campaignId: lf.c1 } },
    ])
  })

  it('draws only changed variants, names the file with the drawn rev and removes old files', async () => {
    const [extra = ''] = addVariants(lf, lf.c1, 1)
    stubDraw(lf)
    data(await publish())
    const [master] = variantsOf(lf)
    bumpRev(lf, extra)
    bumpRev(lf, extra)
    vi.restoreAllMocks()
    const draw = stubDraw(lf)
    expect(await publish()).toEqual({ ok: true, data: { variants: 2, drawn: 1 } })
    expect(draw.mock.calls.map((c) => c[1])).toEqual([extra])
    expect(onDisk(fileOf(extra, 2))).toBe(true)
    expect(onDisk(fileOf(extra, 0))).toBe(false)
    expect(onDisk(fileOf(master!.id, master!.rev))).toBe(true)
    expect(gallery().find((v) => v.variantKey === extra)?.version).toBe(2)
    expect(readVariants(lf.db(), lf.c1, log()).find((v) => v.variantId === extra)).toMatchObject({
      publishedRev: 2,
    })
  })

  it.each([
    ['the draw', () => stubDraw(lf, 'zz2223')],
    ['the upload', () => (stubDraw(lf), failingStore('put', 1))],
    ['the signing', () => (stubDraw(lf), failingStore('signedUrl', 1))],
    [
      'the service',
      () => (
        stubDraw(lf),
        lf.stand.once('replaceGallery', {
          status: 500,
          json: { error: { code: 'internal', message: 'x' } },
        })
      ),
    ],
  ])(
    'leaves the gallery as it was and removes this run’s files when %s fails',
    async (step, arrange) => {
      addVariants(lf, lf.c1, 3)
      stubDraw(lf)
      data(await publish())
      const was = gallery()
      const rows = readVariants(lf.db(), lf.c1, log())
      const ids = variantsOf(lf).map((v) => v.id)
      for (const id of ids) bumpRev(lf, id)
      vi.restoreAllMocks()
      arrange()
      const before = lf.f.events.length
      const reply = await publish()
      expect(reply.ok).toBe(false)
      if (step === 'the draw') {
        const title = variantsOf(lf).find((v) => v.id === 'zz2223')?.title ?? ''
        expect(reply).toEqual({
          ok: false,
          error: {
            code: 'RULE_VIOLATION',
            message: renderFailedMessage(title),
            details: { reason: 'render_failed', variantId: 'zz2223' },
          },
        })
      } else if (step === 'the service') {
        expect(reply).toMatchObject({ error: { code: 'PROVIDER_ERROR' } })
      } else {
        expect(reply).toEqual({
          ok: false,
          error: {
            code: 'PROVIDER_ERROR',
            message: plainMessage('offline', 'Amazon S3'),
            details: { provider: 's3', kind: 'offline' },
          },
        })
      }
      expect(gallery()).toEqual(was)
      for (const id of ids) {
        expect(onDisk(fileOf(id, 0))).toBe(true)
        expect(onDisk(fileOf(id, 1))).toBe(false)
      }
      expect(readVariants(lf.db(), lf.c1, log())).toEqual(rows)
      await Promise.resolve()
      expect(changedEvents(before)).toEqual([])
    },
  )

  it('does not fail when the old files cannot be removed, and logs it once', async () => {
    stubDraw(lf)
    failingStore('list')
    expect(await publish()).toMatchObject({ ok: true, data: { variants: 1, drawn: 1 } })
    const lines = lf.f
      .readLogs()
      .split('\n')
      .filter((l) => l.includes('approvals.pictures'))
    expect(lines).toHaveLength(1)
  })

  it('refuses more than 500 variants before drawing or sending anything', async () => {
    addVariants(lf, lf.c1, 500)
    const draw = stubDraw(lf)
    const sent = lf.stand.seen.length
    expect(await publish()).toEqual({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: APPROVALS_REASON_MESSAGES.too_many_variants,
        details: { reason: 'too_many_variants' },
      },
    })
    expect(draw).not.toHaveBeenCalled()
    expect(lf.stand.seen.length).toBe(sent)
  })

  it.each([
    ['no bucket', 'approvals_needs_bucket'],
    ['no live link', 'approval_link_missing'],
  ] as const)('refuses with %s and sends nothing', async (name, reason) => {
    const draw = stubDraw(lf)
    if (name === 'no bucket') lf.f.core.settings.update({ storage: { s3: null } })
    else data(await lf.f.user('approvals.endLink', pair(lf)))
    const sent = lf.stand.seen.length
    expect(await publish()).toEqual({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: APPROVALS_REASON_MESSAGES[reason],
        details: { reason },
      },
    })
    expect(draw).not.toHaveBeenCalled()
    expect(lf.stand.seen.length).toBe(sent)
  })

  it('refuses a link the service no longer has and removes this run’s files', async () => {
    stubDraw(lf)
    lf.stand.links.delete(`${lf.projectId}/${lf.c1}`)
    const [master] = variantsOf(lf)
    expect(await publish()).toEqual({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: APPROVALS_REASON_MESSAGES.approval_link_gone,
        details: { reason: 'approval_link_gone' },
      },
    })
    expect(onDisk(fileOf(master!.id, master!.rev))).toBe(false)
    expect(readLink(lf.db(), lf.c1, log())).toMatchObject({ state: 'live', publishedAt: null })
  })

  it('leaves the other campaign’s gallery and files alone', async () => {
    stubDraw(lf)
    data(await publish(lf.c2))
    const theirs = gallery(lf.c2)
    data(await publish())
    expect(gallery(lf.c2)).toEqual(theirs)
    const [other] = variantsOf(lf, lf.c2)
    expect(onDisk(fileOf(other!.id, other!.rev, lf.c2))).toBe(true)
  })
})
