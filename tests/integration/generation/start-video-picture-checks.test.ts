// CU-6b-M N-4 and N-8 (security class): every refusal of a picture start of
// generation.startVideo comes before any job row and before any request to the stand-in.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { makeComfyFixture, type ComfyFixture } from './comfy-fixture'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import { serveNeeds, serveVideo } from '../../helpers/comfy-run'
import { insertTestAsset } from '../assets/asset-rows'
import { greyPng } from '@/main/providers/fake/png'
import { vp8x, webp } from '../../fixtures/webp-bytes'

let f: ComfyFixture
let stand: StandIn | null = null
afterEach(async () => {
  f.cleanup()
  await stand?.close()
  stand = null
})

const ask = {
  variantId: 'v1',
  prompt: 'A bottle on a rock',
  durationMs: 2_000,
  provider: 'comfyui',
  start: 'none',
  useReferences: false,
  referenceAssetIds: [] as string[],
}
const frameAsk = (id: string) => ({ ...ask, start: 'first_frame', referenceAssetIds: [id] })
const refAsk = (...ids: string[]) => ({ ...ask, useReferences: true, referenceAssetIds: ids })

async function ready(devTools = true): Promise<void> {
  stand = await startComfyStandIn()
  serveNeeds(stand)
  serveVideo(stand)
  f = await makeComfyFixture({ devTools, origin: stand.origin })
}

async function refused(input: Record<string, unknown>, error: Record<string, unknown>) {
  expect(await f.user('generation.startVideo', input)).toMatchObject({ ok: false, error })
  expect(f.jobs()).toEqual([])
  expect(stand?.seen).toEqual([])
}

const choose = { code: 'INVALID_INPUT', message: 'Choose one picture for this video.' }

describe('generation.startVideo picture start refusals [SPEC 14 1.60 CU-6b N-4] (security class)', () => {
  it.each([
    ['first_frame with no ID', { ...ask, start: 'first_frame' }],
    ['useReferences with no ID', { ...ask, useReferences: true }],
    ['an ID with none and useReferences false', { ...ask, referenceAssetIds: ['a1'] }],
    ['two IDs on first_frame', { ...ask, start: 'first_frame', referenceAssetIds: ['a', 'b'] }],
  ])('refuses %s with INVALID_INPUT', async (_, input) => {
    await ready()
    await refused(input, choose)
  })

  it('refuses a first frame with references: comfy_job_not_offered', async () => {
    await ready()
    const id = await f.importPicture('pics', 'shoe.png')
    const input = { ...frameAsk(id), useReferences: true }
    await refused(input, { code: 'RULE_VIOLATION', details: { reason: 'comfy_job_not_offered' } })
  })

  it('refuses two references with too_many_references and max 1 [1.59 L-16]', async () => {
    await ready()
    const a = await f.importPicture('pics', 'a.png')
    const b = await f.importPicture('pics', 'b.png', greyPng(7, 4))
    await refused(refAsk(a, b), {
      code: 'RULE_VIOLATION',
      message: 'ComfyUI takes one reference picture for this run.',
      details: { reason: 'too_many_references', max: 1 },
    })
  })

  // Slice WP: the approved change. A WebP is turned into a PNG, so the start is taken.
  it.each([['first frame'], ['reference']])('accepts a WebP %s', async (which) => {
    await ready()
    const id = await f.importPicture('pics', 'shoe.webp', webp(vp8x(6, 4, false)))
    const input = which === 'reference' ? refAsk(id) : frameAsk(id)
    expect(await f.user('generation.startVideo', input)).toMatchObject({ ok: true })
    expect(f.jobs()).toHaveLength(1)
  })

  it('refuses a picture whose file is gone: MISSING_FILE', async () => {
    await ready()
    const id = await f.importPicture('pics', 'shoe.png')
    fs.rmSync(path.join(f.root, 'pics', 'shoe.png'))
    await refused(frameAsk(id), { code: 'MISSING_FILE' })
  })

  it('refuses an asset ID that is not there: NOT_FOUND', async () => {
    await ready()
    await refused(refAsk('no-such-asset'), { code: 'NOT_FOUND' })
  })

  it.each([['first frame'], ['reference']])(
    'with dev tools off, a %s start is not offered: comfy_job_not_offered',
    async (which) => {
      await ready(false)
      const id = await f.importPicture('pics', 'shoe.png')
      await refused(which === 'reference' ? refAsk(id) : frameAsk(id), {
        code: 'RULE_VIOLATION',
        details: { reason: 'comfy_job_not_offered' },
      })
    },
  )

  it.each([['first frame'], ['reference']])(
    'with ComfyUI ticked by the user, the agent %s start is accepted [AR-1]',
    async (which) => {
      await ready()
      await f.user('agentRuns.setAllowed', { provider: 'comfyui', allowed: true })
      const id = await f.importPicture('pics', 'shoe.png')
      const input = which === 'reference' ? refAsk(id) : frameAsk(id)
      expect(await f.agent('generation.startVideo', input)).toMatchObject({ ok: true })
      expect(f.jobs()).toHaveLength(1)
      expect(f.jobs()[0]).toMatchObject({ startedBy: 'agent', seenAt: null })
    },
  )

  it.each([['first frame'], ['reference']])(
    'with no tick, the agent is refused a %s start at gate step 2 and nothing is sent [AR-1]',
    async (which) => {
      await ready()
      const id = await f.importPicture('pics', 'shoe.png')
      const input = which === 'reference' ? refAsk(id) : frameAsk(id)
      expect(await f.agent('generation.startVideo', input)).toEqual({
        ok: false,
        error: {
          code: 'AGENT_DENIED',
          message:
            "The user has not allowed agents to start runs with ComfyUI. They can allow it in Adman's Settings.",
        },
      })
      expect(f.jobs()).toEqual([])
      expect(stand?.seen).toEqual([])
    },
  )
})

// Review CU-6b-M M-1 (N-8): the other refusals of N-4 on a picture start.
describe('generation.startVideo picture start refusals, continued [SPEC 14 1.60 CU-6b N-4, N-8] (security class)', () => {
  it('refuses a picture over the size limit: asset_too_large', async () => {
    await ready()
    const id = await f.importPicture('pics', 'shoe.png')
    fs.truncateSync(path.join(f.root, 'pics', 'shoe.png'), 32 * 1024 * 1024 + 1)
    await refused(frameAsk(id), { code: 'RULE_VIOLATION', details: { reason: 'asset_too_large' } })
  })

  it('refuses a picture start with no address saved: comfy_address_needed', async () => {
    stand = await startComfyStandIn()
    serveNeeds(stand)
    serveVideo(stand)
    f = await makeComfyFixture({ devTools: true })
    const id = await f.importPicture('pics', 'shoe.png')
    await refused(frameAsk(id), {
      code: 'RULE_VIOLATION',
      details: { reason: 'comfy_address_needed' },
    })
  })

  it('refuses a picture start longer than the workflow makes: video_too_long', async () => {
    await ready()
    const id = await f.importPicture('pics', 'shoe.png')
    const long = { ...frameAsk(id), durationMs: 15_001 }
    await refused(long, {
      code: 'RULE_VIOLATION',
      details: { reason: 'video_too_long', maxMs: 15_000 },
    })
  })

  it('refuses a video asset given as a picture: picture_not_usable [N-18]', async () => {
    await ready()
    insertTestAsset(f.db, {
      id: 'vid1',
      relPath: 'clips/ad.mp4',
      absPath: path.join(f.root, 'clips', 'ad.mp4'),
      kind: 'video',
      library: 'reference',
      mime: 'video/mp4',
    })
    await refused(frameAsk('vid1'), {
      code: 'RULE_VIOLATION',
      details: { reason: 'picture_not_usable' },
    })
  })
})
