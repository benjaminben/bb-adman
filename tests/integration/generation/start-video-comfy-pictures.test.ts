// CU-6b-M end to end (security class): generation.startVideo from a first frame or one
// reference picture, against the stand-in, through the real core, job runner and asset store
// (SPEC 14 1.60 N-6 to N-8). fitPicture is a stand-in for CU-6b-F's fitter. The adapter and
// the job poll on their real 2 s clocks.
import { describe, it, expect, afterEach } from 'vitest'
import { makeComfyFixture, type ComfyFixture } from './comfy-fixture'
import { waitFor } from './generation-fixture'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import { finishRun, serveNeeds, serveVideo, videoHistoryEntry } from '../../helpers/comfy-run'
import { data } from '../core-fixture'
import { greyPng } from '../../../src/main/providers/fake/png'
import { uploadName } from '../../../src/main/providers/comfyui/values'
import {
  h3ImageToVideo,
  h3ReferenceToVideo,
} from '../../../src/main/providers/comfyui/workflows/h3'
import { fitSize, type Size } from '../../../src/shared/comfy/fit-size'
import type { VideoJobResult } from '../../../src/shared/schemas/jobs/video-generation'

let f: ComfyFixture
let stand: StandIn | null = null
afterEach(async () => {
  f.cleanup()
  await stand?.close()
  stand = null
})

const RUN_MS = 15_000
const PHOTO = greyPng(12, 16)
const RUN_SIZE = fitSize({ width: 1080, height: 1350 }, h3ImageToVideo.size)
const FITTED = greyPng(RUN_SIZE.width, RUN_SIZE.height)
const ask = {
  variantId: 'v1',
  prompt: 'A bottle on a rock',
  durationMs: 2_000,
  provider: 'comfyui',
  start: 'none',
  useReferences: false,
}

type Graph = Record<string, { class_type: string; inputs: Record<string, unknown> }>
type Fit = { bytes: Uint8Array; size: Size }

async function ready(): Promise<{ fits: Fit[]; id: string }> {
  stand = await startComfyStandIn()
  serveNeeds(stand)
  serveVideo(stand)
  const fits: Fit[] = []
  const fitPicture = (bytes: Uint8Array, size: Size) => {
    fits.push({ bytes, size })
    return FITTED
  }
  f = await makeComfyFixture({ devTools: true, origin: stand.origin, fitPicture })
  const id = await f.importPicture('Private Shoots', 'secret-shoe.png', PHOTO)
  return { fits, id }
}

async function submittedGraph(): Promise<{ promptId: string; graph: Graph }> {
  await waitFor(() => stand?.seen.some((r) => r.path === '/prompt') ?? false, RUN_MS)
  const sent = stand?.seen.find((r) => r.path === '/prompt')?.body.toString('utf8') ?? '{}'
  const body = JSON.parse(sent) as { prompt_id: string; prompt: Graph }
  return { promptId: body.prompt_id, graph: body.prompt }
}

async function finished(jobId: string, promptId: string) {
  const entry = videoHistoryEntry(h3ImageToVideo.slots.outputNode, promptId)
  if (stand) finishRun(stand, promptId, entry)
  await waitFor(() => ['succeeded', 'failed'].includes(f.job(jobId)?.status ?? ''), RUN_MS)
  return f.job(jobId)
}

const uploads = () => stand?.seen.filter((r) => r.path === '/upload/image') ?? []

// No request carries the picture's path, display name, folder or asset ID.
function nothingAbout(id: string): void {
  for (const r of stand?.seen ?? []) {
    const text = `${r.path} ${r.body.toString('latin1')}`
    for (const secret of [id, 'secret-shoe', 'Private Shoots', f.root]) {
      expect(text).not.toContain(secret)
    }
  }
}

describe('generation.startVideo from a first frame against the stand-in [SPEC 14 1.60 CU-6b]', () => {
  it('fits the picture to the run size, uploads only the fitted PNG under uploadName, fills node 15', async () => {
    const { fits, id } = await ready()
    const input = { ...ask, start: 'first_frame', referenceAssetIds: [id] }
    const { jobId } = data<{ jobId: string }>(await f.user('generation.startVideo', input))
    expect(f.job(jobId)?.request).toMatchObject({ start: 'first_frame', referenceAssetIds: [id] })
    const { promptId, graph } = await submittedGraph()
    expect(fits).toEqual([{ bytes: PHOTO, size: RUN_SIZE }])
    expect(uploads()).toHaveLength(1)
    const body = uploads()[0]?.body ?? Buffer.alloc(0)
    expect(body.toString('latin1')).toContain(`filename="${uploadName(FITTED)}"`)
    expect(body.includes(Buffer.from(FITTED))).toBe(true)
    expect(body.includes(Buffer.from(PHOTO))).toBe(false)
    expect(graph['5']?.class_type).toBe('MiniMaxH3ImageToVideo')
    expect(graph['5']?.inputs).toMatchObject(RUN_SIZE)
    expect(graph['15']?.inputs.image).toBe(`adman/${uploadName(FITTED)}`)
    const job = await finished(jobId, promptId)
    expect(job).toMatchObject({ status: 'succeeded', paidCalls: 0, remoteJobId: promptId })
    const result = job?.result as VideoJobResult
    expect(f.asset(result.assetId)).toMatchObject({
      kind: 'video',
      genModel: h3ImageToVideo.model.mainFile,
    })
    nothingAbout(id)
  }, 25_000)

  it('a fitted frame not at the run size: the job fails and nothing is uploaded', async () => {
    stand = await startComfyStandIn()
    serveNeeds(stand)
    const fitPicture = () => greyPng(RUN_SIZE.width, RUN_SIZE.height + 32)
    f = await makeComfyFixture({ devTools: true, origin: stand.origin, fitPicture })
    const id = await f.importPicture('pics', 'shoe.png', PHOTO)
    const input = { ...ask, start: 'first_frame', referenceAssetIds: [id] }
    const { jobId } = data<{ jobId: string }>(await f.user('generation.startVideo', input))
    await waitFor(() => f.job(jobId)?.status === 'failed', RUN_MS)
    expect(stand.seen).toEqual([])
  }, 25_000)
})

describe('generation.startVideo with one reference against the stand-in [SPEC 14 1.60 CU-6b]', () => {
  it('uploads the picture as read under uploadName, drops node 16, stores the clip with its model', async () => {
    const { fits, id } = await ready()
    const input = { ...ask, useReferences: true, referenceAssetIds: [id] }
    const { jobId } = data<{ jobId: string }>(await f.user('generation.startVideo', input))
    expect(f.job(jobId)?.request).toMatchObject({ start: 'none', referenceAssetIds: [id] })
    const { promptId, graph } = await submittedGraph()
    expect(fits).toEqual([])
    expect(uploads()).toHaveLength(1)
    const body = uploads()[0]?.body ?? Buffer.alloc(0)
    expect(body.toString('latin1')).toContain(`filename="${uploadName(PHOTO)}"`)
    expect(body.includes(Buffer.from(PHOTO))).toBe(true)
    expect(graph['5']?.class_type).toBe('MiniMaxH3ReferenceToVideo')
    expect(graph['15']?.inputs.image).toBe(`adman/${uploadName(PHOTO)}`)
    expect(graph).not.toHaveProperty('16')
    expect(graph['5']?.inputs).not.toHaveProperty('ref_images.ref_image_1')
    const job = await finished(jobId, promptId)
    expect(job?.status).toBe('succeeded')
    const result = job?.result as VideoJobResult
    expect(f.asset(result.assetId)).toMatchObject({ genModel: h3ReferenceToVideo.model.mainFile })
    nothingAbout(id)
  }, 25_000)

  it('the address changes during the run: address_changed, nothing more sent to the old one', async () => {
    const { id } = await ready()
    const input = { ...ask, useReferences: true, referenceAssetIds: [id] }
    const { jobId } = data<{ jobId: string }>(await f.user('generation.startVideo', input))
    await submittedGraph()
    data(await f.user('comfy.setAddress', { address: 'http://192.0.2.9:8188' }))
    const seenAtChange = stand?.seen.length ?? 0
    await waitFor(() => f.job(jobId)?.status === 'failed', RUN_MS)
    expect(f.job(jobId)).toMatchObject({ errorReason: 'address_changed' })
    expect(stand?.seen.length).toBe(seenAtChange)
  }, 25_000)
})

describe('job.retry of a ComfyUI video from a first frame [SPEC 14 1.60 N-5]', () => {
  it('a new job from the old row reads and fits the picture again and uploads it', async () => {
    const { fits, id } = await ready()
    const input = { ...ask, start: 'first_frame', referenceAssetIds: [id] }
    const first = data<{ jobId: string }>(await f.user('generation.startVideo', input)).jobId
    const { promptId } = await submittedGraph()
    const error = { status: { status_str: 'error', completed: false, messages: [] }, outputs: {} }
    if (stand) finishRun(stand, promptId, error)
    await waitFor(() => f.job(first)?.status === 'failed', RUN_MS)
    const { jobId } = data<{ jobId: string }>(await f.user('job.retry', { jobId: first }))
    expect(f.job(jobId)?.request).toMatchObject({ start: 'first_frame', referenceAssetIds: [id] })
    await waitFor(() => uploads().length === 2, RUN_MS)
    expect(fits).toHaveLength(2)
    nothingAbout(id)
  }, 40_000)
})
