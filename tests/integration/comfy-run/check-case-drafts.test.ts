import { describe, it, expect, afterEach } from 'vitest'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import { createComfyClient } from '../../../src/main/providers/comfyui/client'
import { h3ReferenceToVideo } from '../../../src/main/providers/comfyui/workflows/h3'
import { recordCalls } from '../../comfy/recorder'
import { runCheckCase, TRIAL_WORKFLOWS } from '../../comfy/check-case'
import { DRAFT_WORKFLOWS } from '../../comfy/draft-files'
import { makePrinter } from '../../comfy/print'

const REF_FILE = 'minimax_h3_ref2va_pruned_int8_convrot.safetensors'

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

const holdsAddress = (lines: string[], s: StandIn) =>
  lines.join('\n').includes('127.0.0.1') || lines.join('\n').includes(String(s.port))

const lineOf = (printed: string[], id: string) =>
  printed.find((l) => l.startsWith(`${id} (draft) model files:`)) ?? ''

describe('case 1, the model files of each draft workflow [SPEC 14 1.57 H-3]', () => {
  it('covers the drafts that are left: the two MOSS edits and the H3 reference video', () => {
    expect(DRAFT_WORKFLOWS.map((w) => w.id)).toEqual([
      'moss-edit-references',
      'moss-extend',
      'h3-reference-to-video',
    ])
  })

  it('prints one line per draft that names a missing file, and prints no address', async () => {
    const { s, printed, print, recorded } = await setUp()
    s.reply('GET /models/diffusion_models', { json: ['other.safetensors'] })
    await runCheckCase(recorded.client, recorded.failures, print)
    const line = lineOf(printed, 'h3-reference-to-video')
    expect(line).toContain(`diffusion_models/${REF_FILE} missing`)
    expect(holdsAddress(printed, s)).toBe(false)
  })

  it('says present for a file in a listed folder, by the app’s own name', async () => {
    const { s, printed, print, recorded } = await setUp()
    s.reply('GET /models/diffusion_models', { json: [`sub/${REF_FILE}`] })
    await runCheckCase(recorded.client, recorded.failures, print)
    expect(lineOf(printed, 'h3-reference-to-video')).toContain(
      `diffusion_models/${REF_FILE} present`,
    )
    expect(printed.join('\n')).not.toContain('sub/')
  })

  it('sends nothing new: no folder only a draft names, and each folder once', async () => {
    const { s, printed, print, recorded } = await setUp()
    await runCheckCase(recorded.client, recorded.failures, print)
    const folders = recorded.calls.filter((c) => c.name === 'modelFiles').map((c) => c.arg)
    const trialFolders = new Set(
      TRIAL_WORKFLOWS.flatMap((w) => w.needs.models.map((m) => m.folder)),
    )
    expect(folders.sort()).toEqual([...trialFolders].sort())
    expect(s.seen.some((r) => r.path === '/models/loras')).toBe(false)
    expect(lineOf(printed, 'moss-extend')).toContain(
      'loras/moss_image_edit_lora_rank_64_bf16.safetensors not listed by the check',
    )
  })

  it('probes no node class of a draft', async () => {
    const { print, recorded } = await setUp()
    await runCheckCase(recorded.client, recorded.failures, print)
    const probed = recorded.calls.filter((c) => c.name === 'nodeInfo').map((c) => c.arg)
    const trialClasses = new Set(TRIAL_WORKFLOWS.flatMap((w) => w.needs.nodeClasses))
    const draftOnly = h3ReferenceToVideo.needs.nodeClasses.filter((c) => !trialClasses.has(c))
    expect(draftOnly.length).toBeGreaterThan(0)
    for (const c of draftOnly) expect(probed).not.toContain(c)
  })
})
