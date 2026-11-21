// CU-6b-M N-6 and N-7 (security class): the ComfyUI video adapter's runSize, and its start
// from a first frame or one reference picture, against the stand-in (SPEC 14 1.60).
import { describe, it, expect, afterEach } from 'vitest'
import { startComfyStandIn, type StandIn } from '../../../../helpers/comfy-stand-in'
import {
  PROMPT_ID,
  comfyContext,
  fakeTiming,
  requestLines,
  serveNeeds,
  serveVideo,
} from '../../../../helpers/comfy-run'
import { comfyVideo } from '../../../../../src/main/providers/comfyui/video'
import { createServerChecks } from '../../../../../src/main/providers/comfyui/needs'
import { uploadName } from '../../../../../src/main/providers/comfyui/values'
import {
  h3ImageToVideo,
  h3ReferenceToVideo,
} from '../../../../../src/main/providers/comfyui/workflows/h3'
import { fitSize } from '../../../../../src/shared/comfy/fit-size'
import { greyPng } from '../../../../../src/main/providers/fake/png'
import { ProviderCancelled } from '../../../../../src/main/providers/types'

let stand: StandIn
let opened = false
afterEach(async () => {
  if (opened) await stand.close()
  opened = false
})

const FRAME = { firstFrame: true, references: false }
const REFS = { firstFrame: false, references: true }
const input = {
  image: null,
  references: [],
  prompt: 'A bottle on a rock',
  durationMs: 2_000,
  width: 1080,
  height: 1350,
}
const runSize = fitSize({ width: 1080, height: 1350 }, h3ImageToVideo.size)

async function standIn(): Promise<StandIn> {
  stand = await startComfyStandIn()
  opened = true
  serveNeeds(stand)
  serveVideo(stand)
  return stand
}

function video() {
  const { timing } = fakeTiming()
  const ctx = comfyContext(() => stand.origin)
  return comfyVideo(ctx, { timing, checks: createServerChecks() })
}

type Graph = Record<string, { class_type: string; inputs: Record<string, unknown> }>
const sentGraph = (): Graph => {
  const sent = stand.seen.find((r) => r.path === '/prompt')?.body.toString('utf8') ?? '{}'
  return (JSON.parse(sent) as { prompt: Graph }).prompt
}
const uploads = () => stand.seen.filter((r) => r.path === '/upload/image')

describe('ComfyUI video runSize [SPEC 14 1.60 N-6]', () => {
  it.each([
    [FRAME, h3ImageToVideo],
    [REFS, h3ReferenceToVideo],
  ])('is fitSize of the variant size and the workflow size for %o', (pair, spec) => {
    const size = video().runSize?.(1080, 1350, pair)
    expect(size).toEqual(fitSize({ width: 1080, height: 1350 }, spec.size))
  })
})

describe('ComfyUI video start from a picture [SPEC 14 1.60 N-7] (security class)', () => {
  it('a first frame: checks, uploads it under uploadName, then submits h3-image-to-video', async () => {
    await standIn()
    const png = greyPng(runSize.width, runSize.height)
    const image = { bytes: png, mime: 'image/png' }
    const { remoteJobId } = await video().start({ ...input, image })
    expect(remoteJobId).toBe(PROMPT_ID)
    const lines = requestLines(stand)
    expect(lines[0]).toBe('GET /system_stats')
    const posts = lines.filter((l) => l.startsWith('POST'))
    expect(posts).toEqual(['POST /upload/image', 'POST /prompt'])
    const [upload] = uploads()
    expect(upload?.body.toString('latin1')).toContain(`filename="${uploadName(png)}"`)
    expect(upload?.body.includes(Buffer.from(png))).toBe(true)
    const graph = sentGraph()
    expect(graph['15']?.inputs.image).toBe(`adman/${uploadName(png)}`)
    expect(graph['5']?.class_type).toBe('MiniMaxH3ImageToVideo')
    expect(graph['5']?.inputs).toMatchObject({ ...runSize, length: 56 })
  })

  it('a first frame not at the run size: throws, and nothing at all is sent', async () => {
    await standIn()
    const png = greyPng(runSize.width + 32, runSize.height)
    const run = video().start({ ...input, image: { bytes: png, mime: 'image/png' } })
    await expect(run).rejects.toThrow(Error)
    expect(uploads()).toEqual([])
    expect(stand.seen).toEqual([])
  })

  it('a first frame that is not a PNG: throws, and nothing is sent', async () => {
    await standIn()
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])
    const image = { bytes: jpeg, mime: 'image/png' }
    await expect(video().start({ ...input, image })).rejects.toThrow(Error)
    expect(stand.seen).toEqual([])
  })

  it('one reference: uploaded as given under uploadName; node 16 and its key dropped', async () => {
    await standIn()
    const photo = greyPng(12, 16)
    await video().start({ ...input, references: [{ bytes: photo, mime: 'image/png' }] })
    const [upload] = uploads()
    expect(uploads()).toHaveLength(1)
    expect(upload?.body.toString('latin1')).toContain(`filename="${uploadName(photo)}"`)
    expect(upload?.body.includes(Buffer.from(photo))).toBe(true)
    const graph = sentGraph()
    expect(graph['5']?.class_type).toBe('MiniMaxH3ReferenceToVideo')
    expect(graph['15']?.inputs.image).toBe(`adman/${uploadName(photo)}`)
    expect(graph).not.toHaveProperty('16')
    expect(graph['5']?.inputs).not.toHaveProperty('ref_images.ref_image_1')
    const size = fitSize({ width: 1080, height: 1350 }, h3ReferenceToVideo.size)
    expect(graph['5']?.inputs).toMatchObject(size)
  })

  it('a cancel before the upload: nothing is uploaded and nothing submitted', async () => {
    await standIn()
    const stop = new AbortController()
    stop.abort()
    const png = greyPng(runSize.width, runSize.height)
    const image = { bytes: png, mime: 'image/png' }
    const run = video().start({ ...input, image }, { signal: stop.signal })
    await expect(run).rejects.toBeInstanceOf(ProviderCancelled)
    expect(requestLines(stand).filter((l) => l.startsWith('POST'))).toEqual([])
  })
})
