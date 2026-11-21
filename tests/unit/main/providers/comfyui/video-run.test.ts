// CU-6a: the ComfyUI video adapter's start and fetchResult against the stand-in, for a video
// from a prompt alone on h3-text-to-video (SPEC 6.10.7, 14 1.41 CU-6a).
import { describe, it, expect, afterEach } from 'vitest'
import { startComfyStandIn, type StandIn } from '../../../../helpers/comfy-stand-in'
import {
  PROMPT_ID,
  RESULT_MP4,
  RESULT_PNG,
  comfyContext,
  fakeTiming,
  finishRun,
  requestLines,
  serveNeeds,
  serveVideo,
  servePicture,
  videoHistoryEntry,
} from '../../../../helpers/comfy-run'
import { comfyVideo } from '@/main/providers/comfyui/video'
import { createServerChecks } from '@/main/providers/comfyui/needs'
import { h3TextToVideo as h3 } from '@/main/providers/comfyui/workflows/h3'
import { fitSize } from '@/shared/comfy/fit-size'
import { ProviderFailure } from '@/main/providers/types'

let stand: StandIn
afterEach(async () => {
  await stand.close()
})

const input = {
  image: null,
  references: [],
  prompt: 'A bottle on a rock',
  durationMs: 2_000,
  width: 1080,
  height: 1920,
}

async function standIn(): Promise<StandIn> {
  stand = await startComfyStandIn()
  serveNeeds(stand)
  serveVideo(stand)
  return stand
}

function video(origin: () => string | null = () => stand.origin) {
  const { timing } = fakeTiming()
  return comfyVideo(comfyContext(origin), { timing, checks: createServerChecks() })
}

const sentGraph = () => {
  const sent = stand.seen.find((r) => r.path === '/prompt')?.body.toString('utf8') ?? '{}'
  return (JSON.parse(sent) as { prompt: Record<string, { inputs: Record<string, unknown> }> })
    .prompt
}

async function failureOf(run: Promise<unknown>) {
  const e: unknown = await run.then(
    () => null,
    (err: unknown) => err,
  )
  expect(e).toBeInstanceOf(ProviderFailure)
  return (e as ProviderFailure).error
}

describe('ComfyUI video start [SPEC 6.10.7, 14 CU-6a]', () => {
  it('checks the server first, then submits h3-text-to-video filled at its slots', async () => {
    await standIn()
    const { remoteJobId } = await video().start(input)
    expect(remoteJobId).toBe(PROMPT_ID)
    const lines = requestLines(stand)
    expect(lines[0]).toBe('GET /system_stats')
    expect(lines.at(-1)).toBe('POST /prompt')
    expect(lines.filter((l) => l.startsWith('POST'))).toEqual(['POST /prompt'])
    const graph = sentGraph()
    const size = fitSize({ width: 1080, height: 1920 }, h3.size)
    expect(graph['5']?.inputs).toMatchObject({ prompt: 'A bottle on a rock', length: 56, ...size })
    expect(graph['14']?.inputs.filename_prefix).toBe(`adman/${PROMPT_ID}`)
    expect(typeof graph['6']?.inputs.noise_seed).toBe('number')
  })

  it('takes the first-run size of the trial workflow [1.46]', async () => {
    await standIn()
    await video().start(input)
    const { width, height } = sentGraph()['5']?.inputs as { width: number; height: number }
    expect(width % 32).toBe(0)
    expect(height % 32).toBe(0)
    expect(width * height).toBeLessThanOrEqual(420_000)
  })

  it('refuses a first frame not at the run size as a fault, with nothing sent [1.60 N-7]', async () => {
    await standIn()
    const frame = { bytes: RESULT_PNG, mime: 'image/png' }
    await expect(video().start({ ...input, image: frame })).rejects.toThrow(Error)
    expect(stand.seen).toEqual([])
  })

  it('no address saved: address_needed, nothing sent', async () => {
    await standIn()
    expect(await failureOf(video(() => null).start(input))).toMatchObject({
      reason: 'address_needed',
    })
    expect(stand.seen).toEqual([])
  })

  it('a server that is not ComfyUI gets exactly one request [1.43 N-03]', async () => {
    await standIn()
    stand.reply('GET /system_stats', { json: { hello: 'world' } })
    expect(await failureOf(video().start(input))).toMatchObject({ reason: 'not_comfyui' })
    expect(requestLines(stand)).toEqual(['GET /system_stats'])
  })

  it('a missing model: missing_items, and no /prompt', async () => {
    await standIn()
    stand.reply('GET /models/diffusion_models', { json: [] })
    expect(await failureOf(video().start(input))).toMatchObject({ reason: 'missing_items' })
    expect(requestLines(stand)).not.toContain('POST /prompt')
  })

  it('a refused graph: server_refused', async () => {
    await standIn()
    stand.reply('POST /prompt', { status: 400, json: { error: { message: 'no' } } })
    expect(await failureOf(video().start(input))).toMatchObject({ reason: 'server_refused' })
  })
})

describe('ComfyUI video fetchResult [SPEC 6.10.7] (security class)', () => {
  async function finished(entry = videoHistoryEntry(h3.slots.outputNode)) {
    await standIn()
    const v = video()
    const { remoteJobId } = await v.start(input)
    finishRun(stand, remoteJobId, entry)
    expect((await v.check(remoteJobId)).status).toBe('succeeded')
    return { v, remoteJobId }
  }

  it('fetches the SaveVideo file from the output folder and gives its bytes', async () => {
    const { v, remoteJobId } = await finished()
    const result = await v.fetchResult(remoteJobId)
    expect(result).toEqual({
      bytes: new Uint8Array(RESULT_MP4),
      mime: 'video/mp4',
      model: h3.model.mainFile,
    })
    const view = stand.seen.find((r) => r.path.startsWith('/view?'))?.path
    expect(view).toBe(`/view?filename=${PROMPT_ID}_00001_.mp4&subfolder=adman&type=output`)
  })

  it('a result that is not an MP4: bad_result', async () => {
    const { v, remoteJobId } = await finished()
    servePicture(stand)
    expect(await failureOf(v.fetchResult(remoteJobId))).toMatchObject({ reason: 'bad_result' })
  })

  it('a file name that leaves its folder is never fetched: bad_result', async () => {
    const entry = videoHistoryEntry(h3.slots.outputNode)
    const item = { filename: '../../secret.mp4', subfolder: 'adman', type: 'output' }
    entry.outputs[h3.slots.outputNode] = { images: [item], animated: [true] }
    const { v, remoteJobId } = await finished(entry)
    expect(await failureOf(v.fetchResult(remoteJobId))).toMatchObject({ reason: 'bad_result' })
    expect(requestLines(stand).some((l) => l.startsWith('GET /view'))).toBe(false)
  })

  it('a file of another type than temp or output is never fetched: bad_result', async () => {
    const entry = videoHistoryEntry(h3.slots.outputNode)
    const item = { filename: 'clip.mp4', subfolder: '', type: 'input' }
    entry.outputs[h3.slots.outputNode] = { images: [item], animated: [true] }
    const { v, remoteJobId } = await finished(entry)
    expect(await failureOf(v.fetchResult(remoteJobId))).toMatchObject({ reason: 'bad_result' })
    expect(requestLines(stand).some((l) => l.startsWith('GET /view'))).toBe(false)
  })

  it('an ID this adapter did not start is not fetched', async () => {
    await standIn()
    const foreign = '3b9e1c2d-5f6a-4b7c-8d9e-0f1a2b3c4d5e'
    await expect(video().fetchResult(foreign)).rejects.toBeInstanceOf(ProviderFailure)
    expect(stand.seen).toEqual([])
  })
})
