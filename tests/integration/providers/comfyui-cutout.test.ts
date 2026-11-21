// P4-9 (spec/ai-jobs.md "Cut-out"; security class): the ComfyUI cut-out adapter against the
// stand-in. One upload of the picture's bytes under uploadName; the graph sent is the shipped
// graph with that name at node 1 and no other value from the caller; the result is read from
// node 6; the details come from the shipped workflow file; a cancel before submission sends
// nothing more. Nothing here contacts a real server.
import { describe, it, expect, afterEach } from 'vitest'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import {
  PROMPT_ID,
  RESULT_PNG,
  comfyContext,
  fakeTiming,
  finishRun,
  historyEntry,
  requestLines,
  serveNeeds,
  servePicture,
} from '../../helpers/comfy-run'
import { adapterFor } from '@/main/providers/adapters'
import { comfyCutout } from '@/main/providers/comfyui/cutout'
import { createServerChecks, type ServerChecks } from '@/main/providers/comfyui/needs'
import { uploadName } from '@/main/providers/comfyui/values'
import { birefnetCutout as spec } from '@/main/providers/comfyui/workflows/birefnet'
import { listProviders } from '@/main/providers/registry'
import { ProviderCancelled, type ImageFile } from '@/main/providers/types'
import { greyPng } from '@/main/providers/fake/png'
import type { Settings } from '@/shared/schemas/settings'

let stand: StandIn
afterEach(async () => {
  await stand.close()
})

const picture: ImageFile = { bytes: greyPng(9, 6), mime: 'image/png' }
// The stand-in keeps an upload under adman/, as the real server does.
const KEPT = `adman/${uploadName(picture.bytes)}`

async function cutoutStandIn(): Promise<StandIn> {
  stand = await startComfyStandIn()
  serveNeeds(stand)
  servePicture(stand)
  return stand
}

function provider(s: StandIn, checks: ServerChecks = createServerChecks()) {
  const { timing } = fakeTiming()
  return comfyCutout(
    comfyContext(() => s.origin),
    { timing, checks },
  )
}

type Sent = { prompt: Record<string, { class_type: string; inputs: Record<string, unknown> }> }
const sentGraph = (s: StandIn) => {
  const body = s.seen.find((r) => r.method === 'POST' && r.path === '/prompt')?.body
  return (JSON.parse(body?.toString('utf8') ?? '{}') as Sent).prompt
}

describe('the ComfyUI cut-out adapter [P4-9, FR-307]', () => {
  it('is joined in adapterFor and makes a cut-out against the stand-in', async () => {
    const s = await cutoutStandIn()
    const row = listProviders({}).filter((p) => p.id === 'comfyui')
    const settings = { comfyui: { baseUrl: s.origin }, mcp: { port: 1 } } as Settings
    const deps = {
      providers: row,
      secrets: { get: () => undefined },
      settings: { get: () => settings },
    }
    const running = adapterFor(deps, 'comfyui', 'cutout').cutOut({ image: picture })
    // The run's own prompt ID, from what it sent; then the run ends.
    await expect.poll(() => s.seen.some((r) => r.path === '/prompt')).toBe(true)
    finishRun(s, sentId(s), historyEntry(spec.slots.outputNode))
    const result = await running
    expect(result.bytes).toEqual(RESULT_PNG)
  })

  it('gives the bytes, the main model file and the details from the shipped spec', async () => {
    const s = await cutoutStandIn()
    finishRun(s, PROMPT_ID, historyEntry(spec.slots.outputNode))
    const result = await provider(s).cutOut({ image: picture })
    expect(result).toEqual({
      bytes: RESULT_PNG,
      mime: 'image/png',
      model: 'birefnet.safetensors',
      details: {
        models: ['birefnet.safetensors'],
        workflow: { id: 'birefnet-cutout', version: spec.version },
      },
    })
  })

  it('sends one upload: the bytes alone, under uploadName (security class)', async () => {
    const s = await cutoutStandIn()
    finishRun(s, PROMPT_ID, historyEntry(spec.slots.outputNode))
    await provider(s).cutOut({ image: picture })
    const uploads = s.seen.filter((r) => r.path === '/upload/image')
    expect(uploads).toHaveLength(1)
    const body = uploads[0]?.body ?? Buffer.alloc(0)
    expect(body.includes(Buffer.from(picture.bytes))).toBe(true)
    expect(body.toString('latin1')).toContain(`filename="${uploadName(picture.bytes)}"`)
  })

  it('sends the shipped graph with the uploaded name at node 1 and no other value', async () => {
    const s = await cutoutStandIn()
    finishRun(s, PROMPT_ID, historyEntry(spec.slots.outputNode))
    await provider(s).cutOut({ image: picture })
    const expected = structuredClone(spec.graph)
    expected['1'] = { class_type: 'LoadImage', inputs: { image: KEPT } }
    expect(sentGraph(s)).toEqual(expected)
  })

  it('reads the result at node 6 only', async () => {
    const s = await cutoutStandIn()
    const item = (filename: string) => ({ images: [{ filename, subfolder: '', type: 'temp' }] })
    finishRun(s, PROMPT_ID, {
      status: { status_str: 'success', completed: true, messages: [] },
      outputs: { '5': item('not-this.png'), '6': item('cut-out.png') },
    })
    await provider(s).cutOut({ image: picture })
    const views = s.seen.filter((r) => r.path.startsWith('/view'))
    expect(views).toHaveLength(1)
    expect(views[0]?.path).toContain('filename=cut-out.png')
  })

  it('sends nothing when cancelled before it starts', async () => {
    const s = await cutoutStandIn()
    const stop = new AbortController()
    stop.abort()
    await expect(provider(s).cutOut({ image: picture }, { signal: stop.signal })).rejects.toThrow(
      ProviderCancelled,
    )
    expect(s.seen).toEqual([])
  })

  it('uploads nothing and submits nothing when cancelled during the check', async () => {
    const s = await cutoutStandIn()
    const stop = new AbortController()
    const inner = createServerChecks()
    const checks: ServerChecks = {
      ...inner,
      run: async (...args: Parameters<ServerChecks['run']>) => {
        const result = await inner.run(...args)
        stop.abort()
        return result
      },
    }
    const run = provider(s, checks).cutOut({ image: picture }, { signal: stop.signal })
    await expect(run).rejects.toThrow(ProviderCancelled)
    const lines = requestLines(s)
    expect(lines[0]).toBe('GET /system_stats')
    expect(lines.some((l) => l.startsWith('POST'))).toBe(false)
  })
})

function sentId(s: StandIn): string {
  const body = s.seen.find((r) => r.path === '/prompt')?.body
  return (JSON.parse(body?.toString('utf8') ?? '{}') as { prompt_id: string }).prompt_id
}
