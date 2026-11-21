import { describe, it, expect, afterEach } from 'vitest'
import { startComfyStandIn, type StandIn } from '../../../../helpers/comfy-stand-in'
import {
  PROMPT_ID,
  RESULT_PNG,
  comfyContext,
  fakeTiming,
  finishRun,
  historyEntry,
  requestLines,
  serveModels,
  servePicture,
} from '../../../../helpers/comfy-run'
import { comfyImage } from '../../../../../src/main/providers/comfyui/image'
import { createServerChecks } from '../../../../../src/main/providers/comfyui/needs'
import { uploadName } from '../../../../../src/main/providers/comfyui/values'
import { flux3KleinEditReferences as flux } from '../../../../../src/main/providers/comfyui/workflows/flux3'
import { ProviderFailure, type ImageFile } from '../../../../../src/main/providers/types'
import { greyPng } from '../../../../../src/main/providers/fake/png'

let stand: StandIn
afterEach(async () => {
  await stand.close()
})

const reference: ImageFile = { bytes: greyPng(7, 5), mime: 'image/png' }

async function fluxStandIn(): Promise<StandIn> {
  stand = await startComfyStandIn()
  serveModels(stand)
  servePicture(stand)
  finishRun(stand, PROMPT_ID, historyEntry(flux.slots.outputNode))
  return stand
}

function provider(s: StandIn) {
  const { timing } = fakeTiming()
  const deps = { timing, checks: createServerChecks() }
  return comfyImage(
    comfyContext(() => s.origin),
    deps,
  )
}

const run = (s: StandIn, references: ImageFile[] = [reference]) =>
  provider(s).generate({ prompt: 'a red chair', references, width: 1080, height: 1350, count: 1 })

const submitted = (s: StandIn) => {
  const body = s.seen.find((r) => r.method === 'POST' && r.path === '/prompt')?.body
  return JSON.parse(body?.toString('utf8') ?? '{}') as {
    prompt: Record<string, { inputs: Record<string, unknown> }>
  }
}

describe('a picture from a prompt and one reference, Flux 3 klein [SPEC 6.10.6, 14 1.46 part C]', () => {
  it('stores the picture the server made, with the workflow model', async () => {
    const s = await fluxStandIn()
    const [result] = await run(s)
    expect(result).toEqual({ bytes: RESULT_PNG, mime: 'image/png', model: flux.model.mainFile })
  })

  it('sends exactly one upload: the reference bytes under adman-{16 hex}.png (security class)', async () => {
    const s = await fluxStandIn()
    await run(s)
    const uploads = s.seen.filter((r) => r.path === '/upload/image')
    expect(uploads).toHaveLength(1)
    const body = uploads[0]?.body ?? Buffer.alloc(0)
    expect(body.includes(Buffer.from(reference.bytes))).toBe(true)
    expect(uploadName(reference.bytes)).toMatch(/^adman-[0-9a-f]{16}\.png$/)
    expect(body.toString('latin1')).toContain(`filename="${uploadName(reference.bytes)}"`)
  })

  it('checks the server first, and uploads only after the check answered ok [N-03]', async () => {
    const s = await fluxStandIn()
    await run(s)
    const lines = requestLines(s)
    expect(lines[0]).toBe('GET /system_stats')
    const upload = lines.indexOf('POST /upload/image')
    expect(upload).toBeGreaterThan(lines.lastIndexOf('GET /object_info/PreviewImage'))
    expect(upload).toBeLessThan(lines.indexOf('POST /prompt'))
  })

  it('names in the graph the file the server answered with, not the name it sent', async () => {
    const s = await fluxStandIn()
    s.reply('POST /upload/image', {
      json: { name: 'adman-0011223344556677 (1).png', subfolder: 'adman', type: 'input' },
    })
    await run(s)
    expect(submitted(s).prompt['10']?.inputs.image).toBe('adman/adman-0011223344556677 (1).png')
  })

  it('fills the prompt, the seed and the file only: no size, since the workflow has no width slot [1.46 B]', async () => {
    const s = await fluxStandIn()
    await run(s)
    const graph = submitted(s).prompt
    expect(graph['6']?.inputs.text).toBe('a red chair')
    expect(typeof graph['9']?.inputs.seed).toBe('number')
    for (const [id, node] of Object.entries(flux.graph)) {
      for (const [input, value] of Object.entries(node.inputs)) {
        const filled = ['6.text', '9.seed', '10.image'].includes(`${id}.${input}`)
        if (!filled) expect(graph[id]?.inputs[input]).toEqual(value)
      }
    }
  })

  it('against a server that is not ComfyUI sends one GET /system_stats and no upload [N-03]', async () => {
    stand = await startComfyStandIn()
    stand.reply('GET /system_stats', { json: { hello: 'not comfy' } })
    const failure = await run(stand).catch((e: unknown) => e)
    expect(failure).toBeInstanceOf(ProviderFailure)
    expect((failure as ProviderFailure).error).toMatchObject({ reason: 'not_comfyui' })
    expect(requestLines(stand)).toEqual(['GET /system_stats'])
  })

  it('stops at missing items: no upload and no prompt [SPEC 6.10.3]', async () => {
    stand = await startComfyStandIn()
    const failure = await run(stand).catch((e: unknown) => e)
    expect((failure as ProviderFailure).error).toMatchObject({
      kind: 'other',
      reason: 'missing_items',
      missing: expect.arrayContaining([
        { what: 'model', name: flux.model.mainFile, folder: 'diffusion_models' },
      ]),
    })
    const lines = requestLines(stand)
    expect(lines).not.toContain('POST /upload/image')
    expect(lines).not.toContain('POST /prompt')
  })
})
