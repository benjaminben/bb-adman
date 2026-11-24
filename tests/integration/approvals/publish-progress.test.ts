// D-110: the steps and counts of approvals.progress (spec/approvals-commands.md "Progress and
// Stop"): drawing before each still, making and sending for each clip, finishing once; the
// run's units. The export is a stand-in; pictures go to the test store.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { campaignVariants } from '@/main/approvals/publish'
import { noMediaTool } from '@/main/media/no-media'
import { data } from '../core-fixture'
import {
  addVariants,
  makeLinkFixture,
  pair,
  setUp,
  stubDraw,
  type LinkFixture,
} from './link-fixture'

const CLIP = Buffer.from('\0\0\0\x18ftypisom made-up clip bytes')
let lf: LinkFixture

beforeEach(async () => {
  lf = await makeLinkFixture()
  await setUp(lf)
  data(await lf.f.user('approvals.createLink', pair(lf)))
  addVariants(lf, lf.c1, 1)
  const videoId = campaignVariants(lf.f.core.deps, lf.db(), lf.c1)[0]!.id
  lf.db()
    .prepare("UPDATE variant SET format = 'video', duration_ms = 6000 WHERE id = ?")
    .run(videoId)
  Object.assign(lf.f.core.deps, { media: { ...noMediaTool, available: () => true } })
  stubDraw(lf)
  vi.spyOn(lf.f.core.deps.export.video, 'exportVariant').mockImplementation(
    async (_jc, _scene, _plan, target, file) => {
      await target.write(file, CLIP)
      return { still: null }
    },
  )
})
afterEach(() => {
  vi.restoreAllMocks()
  return lf.close()
})

const publish = () => lf.f.user('approvals.publish', pair(lf))
const progress = () =>
  lf.f.events.filter((e) => e.name === 'approvals.progress').map((e) => e.payload)
const event = (step: string, done: number, total: number, unitsDone: number) => ({
  projectId: lf.projectId,
  campaignId: lf.c1,
  step,
  done,
  total,
  unitsDone,
  unitsTotal: 4,
})

describe('approvals.progress steps and units [D-110]', () => {
  it('sends drawing, making, sending and finishing with the run’s units', async () => {
    expect(await publish()).toMatchObject({ ok: true, data: { drawn: 2, clips: 1 } })
    expect(progress()).toEqual([
      event('drawing', 0, 2, 0),
      event('making', 0, 1, 1),
      event('sending', 0, 1, 2),
      event('drawing', 1, 2, 3),
      event('finishing', 0, 0, 4),
    ])
  })

  it('sends only finishing, with both unit counts at 0, when the run draws and makes nothing', async () => {
    data(await publish())
    const from = progress().length
    expect(await publish()).toMatchObject({ ok: true, data: { drawn: 0, clips: 0 } })
    expect(progress().slice(from)).toEqual([{ ...event('finishing', 0, 0, 0), unitsTotal: 0 }])
  })
})
