// R2V-5: "Update gallery" makes and sends clips (spec/phases/round-2-approvals-video.md "The
// app: making and sending clips"). The reuse table, the still-only reasons, a failed or changed
// clip, a stop before the second clip, health before any draw, and the keep set. The export is
// a stand-in that writes a fixed small file through the target; pictures go to the test store.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readVariants } from '@/main/approvals/local-store'
import { campaignVariants, publishGallery } from '@/main/approvals/publish'
import { createApprovalsClient } from '@/main/approvals/client'
import { TEST_PICTURES_FOLDER } from '@/main/approvals/test-picture-store'
import type { PictureStore } from '@/main/approvals/types'
import { ExportFailure } from '@/main/export/failure'
import { noMediaTool } from '@/main/media/no-media'
import { CLIP_MAX_BYTES, CLIP_MAX_MS, SERVICE_NAME } from '@/shared/approvals/contract'
import { clipPath, picturePath } from '@/shared/approvals/picture-paths'
import {
  APPROVALS_FAILURE_MESSAGES,
  APPROVALS_REASON_MESSAGES,
  clipFailedMessage,
  variantChangedMessage,
} from '@/shared/approvals/messages'
import { data } from '../core-fixture'
import {
  KEY,
  addVariants,
  bumpRev,
  makeLinkFixture,
  pair,
  setUp,
  stubDraw,
  type LinkFixture,
} from './link-fixture'

const CLIP = Buffer.from('\0\0\0\x18ftypisom made-up clip bytes')
let lf: LinkFixture
let videoId: string

beforeEach(async () => {
  lf = await makeLinkFixture()
  await setUp(lf)
  data(await lf.f.user('approvals.createLink', pair(lf)))
  videoId = campaignVariants(lf.f.core.deps, lf.db(), lf.c1)[0]!.id
  makeVideo(6000)
  tool(true)
})
afterEach(() => {
  vi.restoreAllMocks()
  return lf.close()
})

const deps = () => lf.f.core.deps
const publish = () => lf.f.user('approvals.publish', pair(lf))
const root = () => path.join(lf.f.userData, TEST_PICTURES_FOLDER)
const onDisk = (rel: string) => fs.existsSync(path.join(root(), rel))
const still = (rev = 0) => picturePath(lf.projectId, lf.c1, videoId, rev)
const clip = (rev = 0) => clipPath(lf.projectId, lf.c1, videoId, rev)
const gallery = () => lf.stand.links.get(`${lf.projectId}/${lf.c1}`)?.gallery ?? []
const sent = () => gallery().find((v) => v.variantKey === videoId)
const row = () => readVariants(lf.db(), lf.c1, deps().log).find((r) => r.variantId === videoId)

function makeVideo(ms: number) {
  lf.db()
    .prepare("UPDATE variant SET format = 'video', duration_ms = ? WHERE id = ?")
    .run(ms, videoId)
}
const tool = (on: boolean) =>
  Object.assign(deps(), { media: { ...noMediaTool, available: () => on } })

// The export stand-in: writes CLIP through the target, then grows it sparse to `size` if given.
function stubExport(opts: { size?: number; fail?: boolean } = {}) {
  return vi
    .spyOn(deps().export.video, 'exportVariant')
    .mockImplementation(async (_jc, _scene, plan, target, file) => {
      if (opts.fail) throw new ExportFailure('The video could not be made.')
      await target.write(file, CLIP)
      if (opts.size) fs.truncateSync(path.join(plan.root, ...file.split('/')), opts.size)
      return { still: null }
    })
}

describe('approvals.publish with a video variant [R2V-5]', () => {
  it('draws the still, makes and uploads the clip, and sends kind and clip', async () => {
    const draw = stubDraw(lf)
    const exp = stubExport()
    expect(await publish()).toEqual({ ok: true, data: { variants: 1, drawn: 1, clips: 1 } })
    expect(draw).toHaveBeenCalledTimes(1)
    expect(exp).toHaveBeenCalledTimes(1)
    expect(fs.readFileSync(path.join(root(), clip()))).toEqual(CLIP)
    expect(sent()).toMatchObject({
      kind: 'video',
      sizeLine: expect.stringMatching(/ · video$/),
      clip: {
        clipUrl: `${lf.stand.origin}/${clip()}`,
        type: 'video/mp4',
        durationMs: 6000,
        bytes: CLIP.length,
      },
    })
    expect(row()).toMatchObject({ clipMs: 6000, clipBytes: CLIP.length, clipMissing: null })
  })

  it('keeps the clip in the folder after the run and after a second run with no edit', async () => {
    stubDraw(lf)
    stubExport()
    data(await publish())
    expect(onDisk(clip())).toBe(true)
    vi.restoreAllMocks()
    const draw = stubDraw(lf)
    const exp = stubExport()
    expect(await publish()).toEqual({ ok: true, data: { variants: 1, drawn: 0, clips: 0 } })
    expect(draw).not.toHaveBeenCalled()
    expect(exp).not.toHaveBeenCalled()
    expect(onDisk(clip())).toBe(true)
    expect(onDisk(still())).toBe(true)
    expect(sent()?.clip).toMatchObject({ clipUrl: `${lf.stand.origin}/${clip()}` })
  })

  it('makes a new clip after a rev change and removes the old one', async () => {
    stubDraw(lf)
    stubExport()
    data(await publish())
    bumpRev(lf, videoId)
    expect(await publish()).toMatchObject({ data: { drawn: 1, clips: 1 } })
    expect(onDisk(clip(1))).toBe(true)
    expect(onDisk(clip(0))).toBe(false)
  })

  it.each([
    ['too_long', () => (makeVideo(CLIP_MAX_MS + 1), stubExport())],
    ['too_large', () => stubExport({ size: CLIP_MAX_BYTES + 1 })],
    ['no_tool', () => (tool(false), stubExport())],
  ] as const)('sends the still only with %s and uploads no clip', async (reason, arrange) => {
    stubDraw(lf)
    const exp = arrange()
    expect(await publish()).toMatchObject({ data: { drawn: 1, clips: 0 } })
    expect(exp).toHaveBeenCalledTimes(reason === 'too_large' ? 1 : 0)
    expect(onDisk(clip())).toBe(false)
    expect(sent()).toMatchObject({ kind: 'video', clip: null })
    expect(row()).toMatchObject({ clipMs: null, clipBytes: null, clipMissing: reason })
    // Same rev again: too_long and too_large make nothing; no_tool stays still only without it.
    vi.restoreAllMocks()
    const draw = stubDraw(lf)
    const again = stubExport()
    expect(await publish()).toMatchObject({ data: { drawn: 0, clips: 0 } })
    expect(draw).not.toHaveBeenCalled()
    expect(again).not.toHaveBeenCalled()
    expect(row()?.clipMissing).toBe(reason)
  })

  it.each([
    ['no_tool', () => undefined],
    [
      'all three clip columns null',
      () => lf.db().prepare('UPDATE approval_variant SET clip_missing = NULL').run(),
    ],
  ])('reuses the still and makes the clip once the tool is there (%s)', async (_name, edit) => {
    tool(false)
    stubDraw(lf)
    data(await publish())
    edit()
    vi.restoreAllMocks()
    tool(true)
    const draw = stubDraw(lf)
    stubExport()
    expect(await publish()).toMatchObject({ data: { drawn: 0, clips: 1 } })
    expect(draw).not.toHaveBeenCalled()
    expect(onDisk(clip())).toBe(true)
    expect(row()).toMatchObject({ clipMs: 6000, clipMissing: null })
  })

  it.each([
    ['a failing export', 'clip_failed'],
    ['a rev change between draw and export', 'variant_changed'],
  ] as const)(
    'fails with %s, removes this run’s uploads and leaves the gallery',
    async (_n, reason) => {
      stubDraw(lf)
      stubExport()
      data(await publish())
      const was = gallery()
      const rows = readVariants(lf.db(), lf.c1, deps().log)
      bumpRev(lf, videoId)
      vi.restoreAllMocks()
      if (reason === 'clip_failed') {
        stubDraw(lf)
        stubExport({ fail: true })
      } else {
        // The still is drawn at rev 1; the variant changes before the export reads it.
        const drawn = stubDraw(lf)
        drawn.mockImplementationOnce(async () => {
          bumpRev(lf, videoId)
          return { png: new Uint8Array([137, 80, 78, 71]), width: 8, height: 8, rev: 1 }
        })
        stubExport()
      }
      const title = campaignVariants(deps(), lf.db(), lf.c1).find((v) => v.id === videoId)!.title
      const message =
        reason === 'clip_failed' ? clipFailedMessage(title) : variantChangedMessage(title)
      expect(await publish()).toEqual({
        ok: false,
        error: { code: 'RULE_VIOLATION', message, details: { reason, variantId: videoId } },
      })
      expect(gallery()).toEqual(was)
      expect(readVariants(lf.db(), lf.c1, deps().log)).toEqual(rows)
      expect(onDisk(still(0)) && onDisk(clip(0))).toBe(true)
      expect(onDisk(still(1)) || onDisk(clip(1))).toBe(false)
    },
  )

  it('stops before the second clip and removes this run’s uploads', async () => {
    const [second] = addVariants(lf, lf.c1, 1)
    lf.db()
      .prepare(
        "UPDATE variant SET format = 'video', duration_ms = 4000, size_label = '7x7' WHERE id = ?",
      )
      .run(second)
    stubDraw(lf)
    const exp = stubExport()
    const stop = new AbortController()
    const steps: string[] = []
    const store: PictureStore = deps().approvals.pictures()
    const work = publishGallery(deps(), {
      project: lf.f.core.projects.requireOpen(lf.projectId),
      pair: pair(lf),
      client: createApprovalsClient(
        { origin: lf.stand.origin, key: KEY },
        { allowLocalHttp: true, log: deps().log },
      ),
      campaignName: 'Spring Sale',
      variants: campaignVariants(deps(), lf.db(), lf.c1),
      published: new Map(),
      signal: stop.signal,
      onStep: ({ step, done, total }) => {
        steps.push(`${step} ${done}/${total}`)
        if (step === 'making' && done === 1) stop.abort()
      },
    })
    await expect(work).rejects.toMatchObject({
      code: 'RULE_VIOLATION',
      message: APPROVALS_REASON_MESSAGES.publish_cancelled,
      details: { reason: 'publish_cancelled' },
    })
    expect(steps).toEqual([
      'drawing 0/2',
      'making 0/2',
      'sending 0/2',
      'drawing 1/2',
      'making 1/2',
    ])
    expect(exp).toHaveBeenCalledTimes(1)
    expect(await store.list(`adman-approvals/${lf.projectId}/${lf.c1}/`)).toEqual([])
    expect(lf.stand.seen.some((s) => s.route === 'replaceGallery')).toBe(false)
  })

  it('asks the service’s health before any draw and stops on a different version', async () => {
    const draw = stubDraw(lf)
    stubExport()
    const from = lf.stand.seen.length
    lf.stand.once('health', { status: 200, json: { service: SERVICE_NAME, contract: 1 } })
    expect(await publish()).toMatchObject({
      ok: false,
      error: { message: APPROVALS_FAILURE_MESSAGES.version },
    })
    expect(draw).not.toHaveBeenCalled()
    expect(lf.stand.seen.slice(from).map((s) => s.route)).toEqual(['health'])
  })
})

describe('the clean-up after a failed run [R2V-7, from R2V-5’s review]', () => {
  it('keeps files that were in the folder before the run and removes only new ones', async () => {
    stubDraw(lf)
    stubExport()
    data(await publish())
    // The local rows are out of date, so this run writes again to still(0) and clip(0).
    lf.db().prepare('DELETE FROM approval_variant WHERE variant_id = ?').run(videoId)
    const [fresh] = addVariants(lf, lf.c1, 1)
    lf.stand.once('replaceGallery', { status: 500, json: { error: { code: 'x', message: 'x' } } })
    expect(await publish()).toMatchObject({ ok: false })
    expect(onDisk(still()) && onDisk(clip())).toBe(true)
    expect(onDisk(picturePath(lf.projectId, lf.c1, fresh!, 0))).toBe(false)
  })
})
