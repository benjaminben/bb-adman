import { describe, it, expect, afterEach } from 'vitest'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import { createComfyClient } from '@/main/providers/comfyui/client'
import { flux3KleinEditReferences } from '@/main/providers/comfyui/workflows/flux3'
import { mossTextToImage } from '@/main/providers/comfyui/workflows/moss'
import { recordCalls, unexpectedCalls } from '../../comfy/recorder'
import { runCheckCase, TRIAL_WORKFLOWS } from '../../comfy/check-case'
import { makePrinter } from '../../comfy/print'

let stand: StandIn | undefined
afterEach(async () => {
  await stand?.close()
  stand = undefined
})

async function setUp() {
  stand = await startComfyStandIn()
  const printed: string[] = []
  const print = makePrinter(stand.origin, (line) => printed.push(line))
  const recorded = recordCalls(createComfyClient({ origin: stand.origin, ownPorts: () => [] }))
  return { s: stand, printed, print, recorded }
}

// The address in every form a line could hold it.
function holdsAddress(lines: string[], s: StandIn): boolean {
  const text = lines.join('\n')
  return (
    text.includes(s.origin) || text.includes(`127.0.0.1:${s.port}`) || text.includes('127.0.0.1')
  )
}

describe('test:comfy case 1, the check [SPEC 14 1.41 CU-5a, 1.45 B-1, 1.46]', () => {
  it('checks the trial workflows only: MOSS picture, the three H3 videos and Flux 3 reference', () => {
    expect(TRIAL_WORKFLOWS.map((w) => w.id)).toEqual([
      'moss-text-to-image',
      'h3-text-to-video',
      'h3-image-to-video',
      'h3-reference-to-video',
      'flux3-klein-edit-references',
      'birefnet-cutout',
    ])
  })

  it("prints the version and, per workflow, the missing items by the app's own names", async () => {
    const { s, printed, print, recorded } = await setUp()
    s.reply('GET /object_info/ReferenceMultiLatent', { status: 404, json: {} })
    const result = await runCheckCase(recorded.client, recorded.failures, print)
    expect(result.outcome).toBe('ok')
    expect(printed[0]).toBe('ComfyUI version: 0.3.40')
    const flux = printed.slice(printed.indexOf('flux3-klein-edit-references: missing'))
    expect(flux).toContain(
      '  model file: diffusion_models/flux3-image-klein-base-int8-convrot.safetensors',
    )
    expect(flux).toContain('  node class: ReferenceMultiLatent')
    expect(printed).toContain('moss-text-to-image: missing')
    expect(printed).toContain('  version: 0.42.0 or later')
    expect(holdsAddress(printed, s)).toBe(false)
  })

  it('prints "complete" for a workflow with nothing missing', async () => {
    const { s, printed, print, recorded } = await setUp()
    s.reply('GET /system_stats', {
      json: { system: { comfyui_version: '0.45.0' }, devices: [] },
    })
    for (const m of flux3KleinEditReferences.needs.models) {
      s.reply(`GET /models/${m.folder}`, { json: [`sub/${m.file}`] })
    }
    await runCheckCase(recorded.client, recorded.failures, print)
    expect(printed).toContain('flux3-klein-edit-references: complete')
    expect(printed).toContain('moss-text-to-image: missing')
  })

  it("makes only the check's calls: systemStats, modelFiles and nodeInfo [6.10.12]", async () => {
    const { print, recorded } = await setUp()
    await runCheckCase(recorded.client, recorded.failures, print)
    expect(recorded.calls[0]?.name).toBe('systemStats')
    expect(unexpectedCalls(recorded.calls, ['systemStats', 'modelFiles', 'nodeInfo'])).toEqual([])
    const folders = recorded.calls.filter((c) => c.name === 'modelFiles').map((c) => c.arg)
    expect(folders).toContain(mossTextToImage.needs.models[0]?.folder)
  })

  it("when a later call fails, prints which call and the failure's kind, reason and detail [B-1]", async () => {
    const { s, printed, print, recorded } = await setUp()
    s.reply('GET /object_info/KSampler', { status: 500, json: {} })
    const result = await runCheckCase(recorded.client, recorded.failures, print)
    expect(result.outcome).toBe('not_comfyui')
    expect(printed).toContain('The check ended: not_comfyui')
    expect(printed).toContain('The call that failed: nodeInfo(KSampler)')
    expect(printed).toContain('kind: other, reason: none, detail: HTTP 500')
    expect(holdsAddress(printed, s)).toBe(false)
  })

  it('when the server does not answer as ComfyUI, sends nothing after systemStats [N-03]', async () => {
    const { s, printed, print, recorded } = await setUp()
    s.reply('GET /system_stats', { status: 404, json: {} })
    const result = await runCheckCase(recorded.client, recorded.failures, print)
    expect(result.outcome).toBe('not_comfyui')
    expect(recorded.calls.map((c) => c.name)).toEqual(['systemStats'])
    expect(s.seen.map((r) => r.path)).toEqual(['/system_stats'])
    expect(printed).toContain('The call that failed: systemStats()')
  })
})
