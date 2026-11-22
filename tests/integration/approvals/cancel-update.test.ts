// R2V-7: progress, Stop and one run per campaign (spec/phases/round-2-approvals-video.md
// "Progress and Stop"). approvals.cancelUpdate during the first clip, after the gallery request
// is sent, and with no run; a second publish while one runs; approvals.progress carries IDs and
// counts only. The export is a stand-in; pictures go to the test store.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { campaignVariants } from '@/main/approvals/publish'
import { TEST_PICTURES_FOLDER } from '@/main/approvals/test-picture-store'
import { ExportFailure } from '@/main/export/failure'
import { noMediaTool } from '@/main/media/no-media'
import { APPROVALS_REASON_MESSAGES } from '@/shared/approvals/messages'
import { pictureFolder } from '@/shared/approvals/picture-paths'
import type { Seen } from '../../helpers/approvals-stand-in'
import { data } from '../core-fixture'
import { makeLinkFixture, pair, setUp, stubDraw, type LinkFixture } from './link-fixture'

const CLIP = Buffer.from('\0\0\0\x18ftypisom made-up clip bytes')
let lf: LinkFixture

beforeEach(async () => {
  lf = await makeLinkFixture()
  await setUp(lf)
  data(await lf.f.user('approvals.createLink', pair(lf)))
  const videoId = campaignVariants(lf.f.core.deps, lf.db(), lf.c1)[0]!.id
  lf.db()
    .prepare("UPDATE variant SET format = 'video', duration_ms = 6000 WHERE id = ?")
    .run(videoId)
  Object.assign(lf.f.core.deps, { media: { ...noMediaTool, available: () => true } })
  stubDraw(lf)
})
afterEach(() => {
  vi.restoreAllMocks()
  return lf.close()
})

const publish = (campaignId = lf.c1) => lf.f.user('approvals.publish', pair(lf, campaignId))
const cancel = () => lf.f.user('approvals.cancelUpdate', pair(lf))
const folderFiles = () => {
  const at = path.join(lf.f.userData, TEST_PICTURES_FOLDER, pictureFolder(lf.projectId, lf.c1))
  return fs.existsSync(at) ? fs.readdirSync(at) : []
}
const refusal = (reason: 'publish_cancelled' | 'update_running') => ({
  ok: false,
  error: {
    code: 'RULE_VIOLATION',
    message: APPROVALS_REASON_MESSAGES[reason],
    details: { reason },
  },
})

// The export stand-in: `during` runs once it is called; with hold, it waits for a stop or for
// `release`, then writes the clip (or fails, as a killed FFmpeg does).
function stubExport(during: () => void = () => undefined) {
  let release = () => undefined as void
  const held = new Promise<void>((r) => (release = r))
  vi.spyOn(lf.f.core.deps.export.video, 'exportVariant').mockImplementation(
    async (jc, _scene, _plan, target, file) => {
      during()
      await Promise.race([held, new Promise((r) => jc.signal.addEventListener('abort', r))])
      if (jc.signal.aborted) throw new ExportFailure('The video could not be made.')
      await target.write(file, CLIP)
      return { still: null }
    },
  )
  return () => release()
}

describe('approvals.cancelUpdate [R2V-7]', () => {
  it('stops during the first clip: publish_cancelled and this run’s uploads removed', async () => {
    let stopped: Promise<unknown> | undefined
    stubExport(() => (stopped = cancel()))
    expect(await publish()).toEqual(refusal('publish_cancelled'))
    expect(await stopped).toEqual({ ok: true, data: { stopped: true } })
    expect(folderFiles()).toEqual([])
    expect(lf.stand.seen.some((s) => s.route === 'replaceGallery')).toBe(false)
    const progress = lf.f.events.filter((e) => e.name === 'approvals.progress')
    expect(progress).toEqual([
      {
        name: 'approvals.progress',
        payload: { projectId: lf.projectId, campaignId: lf.c1, step: 'making', done: 0, total: 1 },
      },
    ])
  })

  it('gives stopped: false once the gallery request is sent, and the update completes', async () => {
    stubExport()()
    let stopped: Promise<unknown> | undefined
    const push = lf.stand.seen.push.bind(lf.stand.seen)
    lf.stand.seen.push = (...items: Seen[]) => {
      if (items.some((s) => s.route === 'replaceGallery')) stopped = cancel()
      return push(...items)
    }
    expect(await publish()).toEqual({ ok: true, data: { variants: 1, drawn: 1, clips: 1 } })
    expect(await stopped).toEqual({ ok: true, data: { stopped: false } })
    expect(folderFiles()).toHaveLength(2)
  })

  it('refuses a second publish of the campaign while one runs; another campaign is not held', async () => {
    data(await lf.f.user('approvals.createLink', pair(lf, lf.c2)))
    let second: Promise<unknown> | undefined
    let other: Promise<unknown> | undefined
    const release = stubExport(() => {
      second = publish()
      other = publish(lf.c2)
    })
    const first = publish()
    await vi.waitFor(() => expect(second).toBeDefined())
    expect(await second).toEqual(refusal('update_running'))
    expect(await other).toMatchObject({ ok: true })
    release()
    expect(await first).toMatchObject({ ok: true, data: { clips: 1 } })
    vi.restoreAllMocks()
    stubDraw(lf)
    expect(await publish()).toMatchObject({ ok: true, data: { drawn: 0 } })
  })

  it('gives stopped: false when no update runs', async () => {
    expect(await cancel()).toEqual({ ok: true, data: { stopped: false } })
  })
})
