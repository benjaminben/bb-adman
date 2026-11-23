// CW-7: test gaps from the CW-3 review (spec/comfyui-custom.md "Which workflow a run gets",
// "Security" rule 7; spec/comfyui-workflows.md "the seed"). With the agent tick off, an
// unknown ID is refused exactly as a known one, so the refusal tells nothing; the seed of a
// first-frame and a reference video start is below 2^32. Against the stand-in only.
import { describe, it, expect, afterEach } from 'vitest'
import { greyPng } from '@/main/providers/fake/png'
import { fitSize } from '@/shared/comfy/fit-size'
import { CUSTOM_SIZE_DEFAULTS } from '@/shared/comfy/custom-workflow'
import { serveVideo, videoHistoryEntry } from '../../helpers/comfy-run'
import { checked } from '../comfy-workflows/store-fixture'
import type { CustomFixture } from '../../fixtures/comfy-custom/load'
import {
  addCustom,
  customRunSetUp,
  finishSubmitted,
  jobEnds,
  prompts,
  type CustomRun,
} from './custom-run-fixture'

let r: CustomRun
afterEach(() => r.close())

const UNKNOWN = 'custom-ffffffffffff'

// The variant v1 of the seed is 1080 by 1350; a first frame is fitted to the run size.
const RUN_SIZE = fitSize({ width: 1080, height: 1350 }, CUSTOM_SIZE_DEFAULTS.video)

const picture = {
  variantId: 'v1',
  slot: 'background',
  prompt: 'p',
  referenceAssetIds: [],
  count: 1,
}
const clip = {
  variantId: 'v1',
  prompt: 'A bottle on a rock',
  durationMs: 2_000,
  start: 'none',
  useReferences: false,
  referenceAssetIds: [],
}

describe('the agent tick off: an unknown ID is refused as a known one [CW-7, rule 7]', () => {
  it.each([
    ['generation.runImages', picture],
    ['generation.startVideo', clip],
  ] as const)('%s', async (name, input) => {
    r = await customRunSetUp()
    const known = addCustom(r, 'picture', 'Lighthouse')
    const ask = (workflowId: string) =>
      r.f.agent(name, { ...input, provider: 'comfyui', workflowId })
    const forKnown = await ask(known)
    const forUnknown = await ask(UNKNOWN)
    expect(forKnown).toMatchObject({ ok: false, error: { code: 'AGENT_DENIED' } })
    expect(forUnknown).toEqual(forKnown)
    expect(r.f.jobs()).toEqual([])
    expect(r.stand.seen).toEqual([])
  })
})

function addVideo(fixture: CustomFixture, name: string): string {
  return r.f.core.deps.comfyWorkflows.add({ checked: checked(fixture), name, addedBy: 'user' })
    .stored.id
}

async function sentSeed(id: string, extra: Record<string, unknown>, out: string, seed: string) {
  const reply = (await r.f.user('generation.startVideo', {
    ...clip,
    provider: 'comfyui',
    workflowId: id,
    ...extra,
  })) as { data?: { jobId: string } }
  await finishSubmitted(r.stand, (promptId) => videoHistoryEntry(out, promptId))
  expect((await jobEnds(r.f, reply.data?.jobId ?? ''))?.status).toBe('succeeded')
  return prompts(r.stand)[0]?.prompt[seed]?.inputs.seed
}

describe('the seed of a custom video start is below 2^32 [CW-7]', () => {
  it('from a first frame', async () => {
    r = await customRunSetUp({ fitPicture: () => greyPng(RUN_SIZE.width, RUN_SIZE.height) })
    serveVideo(r.stand)
    const id = addVideo('video-first-frame', 'Turning bottle')
    const frame = await r.f.importPicture('Shoots', 'bottle.png', greyPng(12, 16))
    const seed = await sentSeed(id, { start: 'first_frame', referenceAssetIds: [frame] }, '5', '4')
    expect(Number.isInteger(seed)).toBe(true)
    expect(seed as number).toBeGreaterThanOrEqual(0)
    expect(seed as number).toBeLessThan(2 ** 32)
  }, 25_000)

  it('with a reference picture', async () => {
    r = await customRunSetUp()
    serveVideo(r.stand)
    const id = addVideo('video-refs', 'Waving')
    const face = await r.f.importPicture('Shoots', 'face.png', greyPng(9, 5))
    const extra = { useReferences: true, referenceAssetIds: [face] }
    const seed = await sentSeed(id, extra, '5', '4')
    expect(Number.isInteger(seed)).toBe(true)
    expect(seed as number).toBeGreaterThanOrEqual(0)
    expect(seed as number).toBeLessThan(2 ** 32)
  }, 25_000)
})
