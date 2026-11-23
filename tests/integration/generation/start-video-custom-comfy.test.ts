// CW-3: generation.startVideo with a custom workflow for each of the three video starts,
// through the real core against the stand-in. The adapter polls on its real 2 s clock.
import { describe, it, expect, afterEach } from 'vitest'
import { greyPng } from '@/main/providers/fake/png'
import { uploadName } from '@/main/providers/comfyui/values'
import { frameCount } from '@/main/providers/comfyui/frames'
import { fitSize } from '@/shared/comfy/fit-size'
import { CUSTOM_SIZE_DEFAULTS } from '@/shared/comfy/custom-workflow'
import type { WorkflowVideo } from '@/shared/schemas/queries/comfy'
import { serveVideo, videoHistoryEntry } from '../../helpers/comfy-run'
import { checked } from '../comfy-workflows/store-fixture'
import type { CustomFixture } from '../../fixtures/comfy-custom/load'
import {
  changedInputs,
  customRunSetUp,
  finishSubmitted,
  jobEnds,
  prompts,
  storedGraph,
  uploads,
  type CustomRun,
} from './custom-run-fixture'

let r: CustomRun
afterEach(() => r.close())

type Reply = { ok: boolean; data?: { jobId: string }; error?: { code: string; details?: unknown } }

// Not the defaults, so the frame count shows the stored values are the ones used.
const VIDEO: WorkflowVideo = { fps: 12, maxMs: 5_000, frameStep: 8, frameOffset: 1 }
const FRAMES = frameCount(2_000, VIDEO)
// The variant v1 of the seed is 1080 by 1350.
const RUN_SIZE = fitSize({ width: 1080, height: 1350 }, CUSTOM_SIZE_DEFAULTS.video)
const FITTED = greyPng(RUN_SIZE.width, RUN_SIZE.height)
const FACE = greyPng(9, 5)

function addVideo(fixture: CustomFixture, name: string): string {
  const entry = r.f.core.deps.comfyWorkflows.add({
    checked: checked(fixture),
    name,
    addedBy: 'user',
    video: VIDEO,
  })
  return entry.stored.id
}

const ask = (extra: Record<string, unknown>) => ({
  variantId: 'v1',
  prompt: 'A bottle on a rock',
  durationMs: 2_000,
  provider: 'comfyui',
  start: 'none',
  useReferences: false,
  referenceAssetIds: [],
  ...extra,
})

async function runs(id: string, extra: Record<string, unknown>, outputNode: string) {
  const reply = (await r.f.user(
    'generation.startVideo',
    ask({ workflowId: id, ...extra }),
  )) as Reply
  expect(reply.ok).toBe(true)
  const jobId = reply.data?.jobId ?? ''
  expect(r.f.job(jobId)?.request).toMatchObject({ workflowId: id })
  await finishSubmitted(r.stand, (promptId) => videoHistoryEntry(outputNode, promptId))
  expect((await jobEnds(r.f, jobId))?.status).toBe('succeeded')
  const sent = prompts(r.stand)
  expect(sent).toHaveLength(1)
  return sent[0]?.prompt ?? {}
}

describe('generation.startVideo with a custom workflow [D-104, CW-3]', () => {
  it('from the prompt alone: the stored graph with its marks filled, frames from its values', async () => {
    r = await customRunSetUp()
    serveVideo(r.stand)
    const id = addVideo('video-prompt', 'Waves')
    const sent = await runs(id, {}, '4')
    expect(FRAMES).toBe(25)
    expect(changedInputs(storedGraph(r, id), sent)).toEqual(
      ['1.text', '2.height', '2.length', '2.width', '3.seed'].sort(),
    )
    expect(sent['2']?.inputs).toMatchObject({ length: FRAMES, ...RUN_SIZE })
    expect(sent['3']?.inputs.seed as number).toBeLessThan(2 ** 32)
    expect(uploads(r.stand)).toEqual([])
  }, 25_000)

  it('from a first frame: one upload of the fitted picture, frames from the stored values', async () => {
    r = await customRunSetUp({ fitPicture: () => FITTED })
    serveVideo(r.stand)
    const id = addVideo('video-first-frame', 'Turning bottle')
    const picture = await r.f.importPicture('Shoots', 'bottle.png', greyPng(12, 16))
    const sent = await runs(id, { start: 'first_frame', referenceAssetIds: [picture] }, '5')
    expect(changedInputs(storedGraph(r, id), sent)).toEqual(
      ['1.text', '2.image', '3.height', '3.num_frames', '3.width', '4.seed'].sort(),
    )
    expect(sent['2']?.inputs.image).toBe(`adman/${uploadName(FITTED)}`)
    expect(sent['3']?.inputs.num_frames).toBe(FRAMES)
    expect(uploads(r.stand)).toHaveLength(1)
  }, 25_000)

  it('with a reference picture: one upload under uploadName, frames from the stored values', async () => {
    r = await customRunSetUp()
    serveVideo(r.stand)
    const id = addVideo('video-refs', 'Waving')
    const picture = await r.f.importPicture('Shoots', 'face.png', FACE)
    const sent = await runs(id, { useReferences: true, referenceAssetIds: [picture] }, '5')
    expect(changedInputs(storedGraph(r, id), sent)).toEqual(
      ['1.text', '2.image', '3.frames', '4.seed'].sort(),
    )
    expect(sent['2']?.inputs.image).toBe(`adman/${uploadName(FACE)}`)
    expect(sent['3']?.inputs.frames).toBe(FRAMES)
  }, 25_000)

  it('refuses a picture workflow named for a video: comfy_workflow_wrong_job, no job', async () => {
    r = await customRunSetUp()
    const id = r.f.core.deps.comfyWorkflows.add({
      checked: checked('picture'),
      name: 'Lighthouse',
      addedBy: 'user',
    }).stored.id
    const reply = (await r.f.user('generation.startVideo', ask({ workflowId: id }))) as Reply
    expect(reply).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'comfy_workflow_wrong_job' } },
    })
    expect(r.f.jobs()).toEqual([])
    expect(r.stand.seen).toEqual([])
  })
})
