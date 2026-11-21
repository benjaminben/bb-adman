// CU-6b-M N-4 and N-8 (security class): every refusal of a picture start of
// generation.startVideo comes before any job row and before any request to the stand-in.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { makeComfyFixture, type ComfyFixture } from './comfy-fixture'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import { serveNeeds, serveVideo } from '../../helpers/comfy-run'

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
    const b = await f.importPicture('pics', 'b.png')
    await refused(refAsk(a, b), {
      code: 'RULE_VIOLATION',
      message: 'ComfyUI takes at most 1 reference picture(s) for this run.',
      details: { reason: 'too_many_references', max: 1 },
    })
  })

  it.each([['first frame'], ['reference']])(
    'refuses a WebP %s: picture_not_usable',
    async (which) => {
      await ready()
      const webp = new Uint8Array(Buffer.from('RIFF\u0010\u0000\u0000\u0000WEBPVP8 ', 'latin1'))
      const id = await f.importPicture('pics', 'shoe.webp', webp)
      await refused(which === 'reference' ? refAsk(id) : frameAsk(id), {
        code: 'RULE_VIOLATION',
        message: 'This picture cannot be used for a video yet. Use a PNG or JPEG.',
        details: { reason: 'picture_not_usable' },
      })
    },
  )

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
    'the agent is refused a %s start with AGENT_DENIED and nothing is sent [1.57 H-1]',
    async (which) => {
      await ready()
      const id = await f.importPicture('pics', 'shoe.png')
      const input = which === 'reference' ? refAsk(id) : frameAsk(id)
      expect(await f.agent('generation.startVideo', input)).toMatchObject({
        ok: false,
        error: { code: 'AGENT_DENIED' },
      })
      expect(f.jobs()).toEqual([])
      expect(stand?.seen).toEqual([])
    },
  )
})
