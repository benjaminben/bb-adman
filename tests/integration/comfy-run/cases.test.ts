import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { startComfyStandIn, type Reply, type StandIn } from '../../helpers/comfy-stand-in'
import { createComfyClient } from '../../../src/main/providers/comfyui/client'
import { uploadName } from '../../../src/main/providers/comfyui/values'
import type { WorkflowSpec } from '../../../src/main/providers/comfyui/workflows/types'
import { flux3KleinEditReferences } from '../../../src/main/providers/comfyui/workflows/flux3'
import { h3TextToVideo } from '../../../src/main/providers/comfyui/workflows/h3'
import { mossTextToImage } from '../../../src/main/providers/comfyui/workflows/moss'
import { foreignCancels, recordCalls } from '../../comfy/recorder'
import { makePrinter } from '../../comfy/print'
import { makeTestPicture } from '../../comfy/test-picture'
import { pictureCase, referenceCase, videoCase, type CaseKit } from '../../comfy/cases'

let stand: StandIn | undefined
let outDir = ''
afterEach(async () => {
  await stand?.close()
  stand = undefined
  if (outDir) fs.rmSync(outDir, { recursive: true, force: true })
  outDir = ''
})

const FTYP = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(16)])

const ID = '0b6f2c1e-7a3d-4c5b-9e8f-1a2b3c4d5e6f'

// Both picture switches are on unless a test passes its own (1.53 G-12).
const SWITCHES_ON = { ADMAN_COMFY_FLUX: '1', ADMAN_COMFY_MOSS: '1' }

async function setUp(env: Record<string, string> = SWITCHES_ON) {
  stand = await startComfyStandIn()
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-comfy-case-'))
  const printed: string[] = []
  const recorded = recordCalls(createComfyClient({ origin: stand.origin, ownPorts: () => [] }))
  const kit: CaseKit = {
    client: recorded.client,
    print: makePrinter(stand.origin, (line) => printed.push(line)),
    timing: { pollMs: 1, limitMs: 60_000, now: Date.now, sleep: () => Promise.resolve() },
    outDir,
    env,
    newId: () => ID,
    fieldNames: { shown: false },
  }
  return { s: stand, printed, recorded, kit }
}

// Everything the workflow needs is there, and the run ends with one file.
function complete(s: StandIn, spec: WorkflowSpec, file: Reply): void {
  s.reply('GET /system_stats', { json: { system: { comfyui_version: '0.45.0' }, devices: [] } })
  const folders = new Set(spec.needs.models.map((m) => m.folder))
  for (const folder of folders) {
    const files = spec.needs.models.filter((m) => m.folder === folder).map((m) => m.file)
    s.reply(`GET /models/${folder}`, { json: files })
  }
  s.reply('GET /view', file)
  const images = [{ filename: 'out.bin', subfolder: '', type: 'temp' }]
  s.reply(`GET /history/${ID}`, {
    json: {
      [ID]: {
        status: { status_str: 'success', completed: true },
        outputs: { [spec.slots.outputNode]: { images } },
      },
    },
  })
}

const holdsAddress = (lines: string[], s: StandIn) =>
  lines.join('\n').includes('127.0.0.1') || lines.join('\n').includes(String(s.port))

describe('one switch per picture case [SPEC 14 1.53 G-12]', () => {
  it('case 5 runs only with ADMAN_COMFY_FLUX=1, and contacts nothing without it', async () => {
    const { s, kit } = await setUp({ ADMAN_COMFY_MOSS: '1', ADMAN_COMFY_FLUX: 'yes' })
    expect(await referenceCase(kit)).toEqual({
      skip: 'ADMAN_COMFY_FLUX is not 1, so the Flux reference case does not run.',
    })
    expect(s.seen).toEqual([])
  })

  it('case 3 runs only with ADMAN_COMFY_MOSS=1, and contacts nothing without it', async () => {
    const { s, kit } = await setUp({ ADMAN_COMFY_FLUX: '1' })
    expect(await pictureCase(kit)).toEqual({
      skip: 'ADMAN_COMFY_MOSS is not 1, so the MOSS picture case does not run.',
    })
    expect(s.seen).toEqual([])
  })
})

describe('case 5, a picture from a reference [SPEC 14 1.46]', () => {
  it('skips with one line when the check finds items missing, and uploads nothing', async () => {
    const { s, printed, recorded, kit } = await setUp()
    const outcome = await referenceCase(kit)
    expect(outcome).toEqual({
      skip: 'flux3-klein-edit-references: 3 items missing, so it does not run.',
    })
    expect(recorded.calls.some((c) => c.name === 'uploadImage' || c.name === 'submit')).toBe(false)
    expect(holdsAddress(printed, s)).toBe(false)
  })

  it("uploads the test's own picture under the app's name, runs, and writes the result", async () => {
    const { s, printed, recorded, kit } = await setUp()
    const picture = Buffer.from(makeTestPicture())
    complete(s, flux3KleinEditReferences, {
      body: picture,
      headers: { 'content-type': 'image/png' },
    })
    const outcome = await referenceCase(kit)
    expect(outcome).toEqual({ done: true })
    const upload = s.seen.filter((r) => r.path === '/upload/image')
    expect(upload).toHaveLength(1)
    const body = upload[0]?.body ?? Buffer.alloc(0)
    expect(body.includes(picture)).toBe(true)
    expect(body.toString('latin1')).toContain(`filename="${uploadName(picture)}"`)
    const sent = JSON.parse(s.seen.find((r) => r.path === '/prompt')?.body.toString() ?? '{}')
    expect(sent.prompt['10'].inputs.image).toBe(`adman/${uploadName(picture)}`)
    const written = printed.find((l) => l.startsWith('Written to: '))?.slice(12) ?? ''
    expect(path.dirname(written)).toBe(outDir)
    expect(fs.readFileSync(written).equals(picture)).toBe(true)
    expect(printed).toContain('Pixel size: 768 x 768')
    expect(printed).toContain(`Byte size: ${picture.byteLength}`)
    expect(printed).toContain(
      'No JPEG run is made; the only JPEG in tests/ is a 1×1 picture inside a Gemini fixture.',
    )
    expect(foreignCancels(recorded.calls)).toEqual([])
    expect(holdsAddress(printed, s)).toBe(false)
  })

  it('fails when the result is not a PNG or JPEG', async () => {
    const { s, kit } = await setUp()
    complete(s, flux3KleinEditReferences, { body: 'not a picture' })
    await expect(referenceCase(kit)).rejects.toThrow('The result is not a PNG or JPEG')
  })
})

describe('case 3, the MOSS picture [SPEC 14 1.41, 1.46 first-run size]', () => {
  it('runs at the smallest size its first-run rule allows, square', async () => {
    const { s, printed, kit } = await setUp()
    complete(s, mossTextToImage, { body: Buffer.from(makeTestPicture()) })
    expect(await pictureCase(kit)).toEqual({ done: true })
    const sent = JSON.parse(s.seen.find((r) => r.path === '/prompt')?.body.toString() ?? '{}')
    const node = sent.prompt[mossTextToImage.slots.width?.node ?? '']
    expect([node.inputs.width, node.inputs.height]).toEqual([928, 928])
    expect(s.seen.some((r) => r.path === '/upload/image')).toBe(false)
    expect(printed.some((l) => l.startsWith('Written to: '))).toBe(true)
  })
})

describe("a case hands its own check's version to the time-out rule [review CU-5a item 1]", () => {
  it('interrupts its own run on time-out only because the check read 0.45.0', async () => {
    const { s, recorded, kit } = await setUp()
    complete(s, mossTextToImage, { body: Buffer.from(makeTestPicture()) })
    s.reply(`GET /history/${ID}`, { json: {} })
    s.reply(`GET /api/jobs/${ID}`, { json: { status: 'in_progress' } })
    let at = 0
    kit.timing = {
      pollMs: 2_000,
      limitMs: 10_000,
      now: () => at,
      sleep: async (ms) => {
        at += ms
      },
    }
    await expect(pictureCase(kit)).rejects.toThrow('its own run was cancelled')
    expect(recorded.calls.filter((c) => c.name === 'interrupt')).toEqual([
      { name: 'interrupt', arg: ID },
    ])
  })
})

describe('case 2, the H3 video [SPEC 14 1.41]', () => {
  it('runs only with ADMAN_COMFY_VIDEO=1, and contacts nothing without it', async () => {
    const { s, kit } = await setUp({})
    expect(await videoCase(kit)).toEqual({
      skip: 'ADMAN_COMFY_VIDEO is not 1, so the video case does not run.',
    })
    expect(s.seen).toEqual([])
  })

  it('runs at 576 x 576 with 56 frames, and passes on an MP4 that starts with ftyp', async () => {
    const { s, printed, kit } = await setUp({ ADMAN_COMFY_VIDEO: '1' })
    complete(s, h3TextToVideo, { body: FTYP })
    expect(await videoCase(kit)).toEqual({ done: true })
    const sent = JSON.parse(s.seen.find((r) => r.path === '/prompt')?.body.toString() ?? '{}')
    const inputs = sent.prompt[h3TextToVideo.slots.width?.node ?? ''].inputs
    expect([inputs.width, inputs.height, inputs.length]).toEqual([576, 576, 56])
    expect(printed).toContain(`Byte size: ${FTYP.byteLength}`)
    expect(printed.find((l) => l.startsWith('Written to: '))).toMatch(/\.mp4$/)
  })

  it('fails on bytes that are not an MP4', async () => {
    const { s, kit } = await setUp({ ADMAN_COMFY_VIDEO: '1' })
    complete(s, h3TextToVideo, { body: 'not a video at all' })
    await expect(videoCase(kit)).rejects.toThrow('The result does not start with an ftyp box')
  })
})

describe('case 4, the field names [SPEC 14 1.41]', () => {
  it('prints the field names of the first ended run, once, with no values', async () => {
    const { s, printed, kit } = await setUp()
    complete(s, mossTextToImage, { body: Buffer.from(makeTestPicture()) })
    await pictureCase(kit)
    const fields = [
      'status',
      'status.statusStr',
      'status.completed',
      'status.messages',
      'outputs',
      'outputs.9',
      'outputs.9.images',
      'outputs.9.images[].filename',
      'outputs.9.images[].subfolder',
      'outputs.9.images[].type',
    ]
    expect(printed).toContain(`History entry fields: ${fields.join(', ')}`)
    expect(printed).toContain('Job state fields: status')
    expect(printed.join(' ')).not.toContain('out.bin')
    const again = printed.length
    s.seen.length = 0
    await pictureCase(kit)
    expect(printed.slice(again).some((l) => l.includes('fields:'))).toBe(false)
  })
})
