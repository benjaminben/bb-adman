// [D-103] The shipped workflows that ran are proven, so a packaged-style app (hand-test tools
// off) with a saved ComfyUI address offers ComfyUI to the user and to a ticked agent for a
// picture from a prompt, a picture from a reference, a video from each start and a cut-out.
// Extend stays a draft, so a fill is never offered.
import { describe, it, expect, afterEach } from 'vitest'
import { makeComfyFixture, type ComfyFixture } from './comfy-fixture'
import { BACKGROUND_LAYER } from './generation-fixture'
import { cutOutInput, givePicture } from './cutout-fixture'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import { serveNeeds, serveVideo } from '../../helpers/comfy-run'
import { data } from '../core-fixture'
import type { ComfyInfo } from '@/shared/schemas/queries/comfy'

let f: ComfyFixture
let stand: StandIn | null = null
afterEach(async () => {
  f.cleanup()
  await stand?.close()
  stand = null
})

const video = {
  variantId: 'v1',
  prompt: 'A bottle on a rock at dawn',
  durationMs: 2_000,
  provider: 'comfyui',
  start: 'none',
  useReferences: false,
  referenceAssetIds: [] as string[],
}

async function noTools(): Promise<void> {
  stand = await startComfyStandIn()
  serveNeeds(stand)
  serveVideo(stand)
  f = await makeComfyFixture({ devTools: false, origin: stand.origin })
  data(await f.user('agentRuns.setAllowed', { provider: 'comfyui', allowed: true }))
}

const accepted = (r: unknown) => expect(r).toMatchObject({ ok: true })

describe('the proven workflows with the hand-test tools off [D-103]', () => {
  for (const actor of ['user', 'agent'] as const) {
    it(`gives the ${actor} a picture from a prompt and from a reference`, async () => {
      await noTools()
      accepted(await f.run({}, actor))
      const ref = await f.importPicture('pics', 'bottle.png')
      accepted(await f.run({ referenceAssetIds: [ref] }, actor))
      expect(f.jobs()).toHaveLength(2)
    })

    it(`gives the ${actor} a video from a prompt, a first frame and a reference`, async () => {
      await noTools()
      const id = await f.importPicture('pics', 'shoe.png')
      accepted(await f[actor]('generation.startVideo', video))
      accepted(
        await f[actor]('generation.startVideo', {
          ...video,
          start: 'first_frame',
          referenceAssetIds: [id],
        }),
      )
      accepted(
        await f[actor]('generation.startVideo', {
          ...video,
          useReferences: true,
          referenceAssetIds: [id],
        }),
      )
      expect(f.jobs()).toHaveLength(3)
    })

    it(`gives the ${actor} a cut-out`, async () => {
      await noTools()
      givePicture(f.db, BACKGROUND_LAYER, await f.importPicture('pics', 'source.png'))
      accepted(await f[actor]('generation.cutOut', cutOutInput({ provider: 'comfyui' })))
      expect(f.jobs()).toMatchObject([{ kind: 'cutout', provider: 'comfyui' }])
    })
  }

  it('marks each proven workflow offered in comfy.getInfo, and no draft', async () => {
    await noTools()
    const info = data<ComfyInfo>(await f.core.query('comfy.getInfo', {}, { actor: 'user' }))
    expect(info.workflows.filter((w) => w.offered).map((w) => w.id)).toEqual([
      'moss-text-to-image',
      'h3-text-to-video',
      'h3-image-to-video',
      'h3-reference-to-video',
      'flux3-klein-edit-references',
      'birefnet-cutout',
    ])
    expect(info.workflows.filter((w) => w.status === 'trial')).toEqual([])
  })
})
