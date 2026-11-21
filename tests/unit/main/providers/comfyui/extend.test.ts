// P5-7: ComfyUI extend in the adapter, against the stand-in only, with a test-only `trial`
// copy of `moss-extend`. Nothing here contacts a real server.
import { describe, it, expect, afterEach } from 'vitest'
import { startComfyStandIn, type StandIn } from '../../../../helpers/comfy-stand-in'
import {
  PROMPT_ID,
  RESULT_PNG,
  comfyContext,
  finishRun,
  historyEntry,
  requestLines,
  serveNeeds,
  servePicture,
} from '../../../../helpers/comfy-run'
import {
  extendInput,
  extender,
  submittedGraph,
  trialExtend,
} from '../../../../helpers/comfy-extend'
import { comfyImage } from '@/main/providers/comfyui/image'
import { offeredWorkflow } from '@/main/providers/comfyui/workflows/offered'
import { mossExtend } from '@/main/providers/comfyui/workflows/moss'
import { uploadName } from '@/main/providers/comfyui/values'
import { ProviderCancelled } from '@/main/providers/types'

let stand: StandIn
afterEach(async () => {
  await stand.close()
})

async function standIn(): Promise<StandIn> {
  stand = await startComfyStandIn()
  serveNeeds(stand)
  stand.reply('GET /models/loras', { json: ['moss_image_edit_lora_rank_64_bf16.safetensors'] })
  servePicture(stand)
  finishRun(stand, PROMPT_ID, historyEntry(trialExtend.slots.outputNode))
  return stand
}

describe('extend a background with ComfyUI [SPEC comfyui-workflows "Extend a background", P5-7]', () => {
  it('returns the picture the server made, with the workflow model and details', async () => {
    const s = await standIn()
    const result = await extender(s).extend(
      extendInput({ x: 420, y: 0, width: 1080, height: 1080 }),
    )
    expect(result).toEqual({
      bytes: RESULT_PNG,
      mime: 'image/png',
      model: trialExtend.model.mainFile,
      details: {
        models: trialExtend.needs.models.map((m) => m.file),
        workflow: { id: 'moss-extend', version: trialExtend.version },
      },
    })
  })

  it('uploads the picture once, as the one reference, under the app name (security class)', async () => {
    const s = await standIn()
    const input = extendInput({ x: 420, y: 0, width: 1080, height: 1080 })
    await extender(s).extend(input)
    const uploads = s.seen.filter((r) => r.path === '/upload/image')
    expect(uploads).toHaveLength(1)
    const body = uploads[0]?.body ?? Buffer.alloc(0)
    expect(body.includes(Buffer.from(input.image.bytes))).toBe(true)
    expect(body.toString('latin1')).toContain(`filename="${uploadName(input.image.bytes)}"`)
    expect(body.toString('latin1')).not.toContain(input.prompt)
    expect(submittedGraph(s)['10']?.inputs.image).toBe(`adman/${uploadName(input.image.bytes)}`)
  })

  it('checks the server, then uploads, then submits [N-03]', async () => {
    const s = await standIn()
    await extender(s).extend(extendInput({ x: 420, y: 0, width: 1080, height: 1080 }))
    const lines = requestLines(s)
    expect(lines[0]).toBe('GET /system_stats')
    const upload = lines.indexOf('POST /upload/image')
    expect(upload).toBeGreaterThan(lines.lastIndexOf('GET /object_info/PreviewImage'))
    expect(upload).toBeLessThan(lines.indexOf('POST /prompt'))
  })

  // Canvas 1920x1080 fits to 1872x1056 (factor 0.975 across, 0.9778 down); 1080x1920 to
  // 1056x1872. Each pad is rounded to a multiple of 8; the picture takes what is left.
  it.each([
    [
      'centred',
      1920,
      1080,
      { x: 420, y: 0 },
      { left: 408, top: 0, right: 408, bottom: 0 },
      1056,
      1056,
    ],
    [
      'off-centre',
      1920,
      1080,
      { x: 100, y: 0 },
      { left: 96, top: 0, right: 720, bottom: 0 },
      1056,
      1056,
    ],
    [
      'rounded up',
      1920,
      1080,
      { x: 120, y: 0 },
      { left: 120, top: 0, right: 704, bottom: 0 },
      1048,
      1056,
    ],
    [
      'tall, centred',
      1080,
      1920,
      { x: 0, y: 420 },
      { left: 0, top: 408, right: 0, bottom: 408 },
      1056,
      1056,
    ],
  ])('%s: fills the four pads and the scaled picture size', async (_n, w, h, at, pad, pw, ph) => {
    const s = await standIn()
    await extender(s).extend(extendInput({ ...at, width: 1080, height: 1080 }, w, h))
    const graph = submittedGraph(s)
    expect(graph['12']?.inputs).toMatchObject(pad)
    for (const side of Object.values(pad)) expect(side % 8).toBe(0)
    expect(graph['11']?.inputs).toMatchObject({ width: pw, height: ph })
    expect(graph['14']?.inputs.text).toBe('extend the background')
    expect(typeof graph['16']?.inputs.seed).toBe('number')
  })

  it('a signal fired before the call: cancelled, and nothing is sent', async () => {
    const s = await standIn()
    const controller = new AbortController()
    controller.abort()
    const input = extendInput({ x: 420, y: 0, width: 1080, height: 1080 })
    await expect(extender(s).extend(input, { signal: controller.signal })).rejects.toBeInstanceOf(
      ProviderCancelled,
    )
    expect(s.seen).toEqual([])
  })

  it('a signal fired after the check: cancelled, with no upload and no submit', async () => {
    const s = await standIn()
    const controller = new AbortController()
    const input = extendInput({ x: 420, y: 0, width: 1080, height: 1080 })
    const run = extender(s, () => controller.abort()).extend(input, { signal: controller.signal })
    await expect(run).rejects.toBeInstanceOf(ProviderCancelled)
    const lines = requestLines(s)
    expect(lines).not.toContain('POST /upload/image')
    expect(lines).not.toContain('POST /prompt')
  })
})

describe('the real moss-extend is a draft and is never sent [P5-7]', () => {
  it('offeredWorkflow offers no extend workflow, even with the hand-test tools on', () => {
    expect(mossExtend.status).toBe('draft')
    expect(offeredWorkflow({ job: 'extend' }, { devTools: true, actor: 'user' })).toBeNull()
    expect(offeredWorkflow({ job: 'extend' }, { devTools: false, actor: 'user' })).toBeNull()
  })

  it('the shipped adapter refuses extend before sending anything', async () => {
    const s = await standIn()
    const provider = comfyImage(comfyContext(() => s.origin))
    const input = extendInput({ x: 420, y: 0, width: 1080, height: 1080 })
    await expect(provider.extend(input)).rejects.toThrow('No shipped workflow for extend')
    expect(s.seen).toEqual([])
  })

  it('a draft handed to the adapter is still refused before anything is sent', async () => {
    const s = await standIn()
    const input = extendInput({ x: 420, y: 0, width: 1080, height: 1080 })
    await expect(extender(s, undefined, [mossExtend]).extend(input)).rejects.toThrow(
      'No shipped workflow for extend',
    )
    expect(s.seen).toEqual([])
  })
})
