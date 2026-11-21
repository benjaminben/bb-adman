import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import { createComfyClient } from '@/main/providers/comfyui/client'
import { uploadName } from '@/main/providers/comfyui/values'
import { h3ImageToVideo as spec } from '@/main/providers/comfyui/workflows/h3'
import { mp4File } from '@/main/providers/fake/mp4'
import { foreignCancels, recordCalls } from '../../comfy/recorder'
import { makePrinter } from '../../comfy/print'
import { makeTestPicture } from '../../comfy/test-picture'
import { firstFrameCase, type CaseKit } from '../../comfy/cases'

const ID = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f'
const CLIP = Buffer.from(mp4File({ width: 576, height: 576, durationMs: 2_333, sound: true }))
// A JPEG start and a baseline frame header: 800 wide, 600 high.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 2, 88, 3, 32, 3, 1, 0x22, 0, 0, 0])
const ON = { ADMAN_COMFY_FRAME: '1' }

const folders: string[] = []
let stand: StandIn | undefined
afterEach(async () => {
  await stand?.close()
  stand = undefined
  for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true })
})

const tempFolder = (prefix: string) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  folders.push(folder)
  return folder
}

// The server has everything the workflow needs (unless `bare`), and the run ends with `clip`.
async function setUp(env: Record<string, string>, opts: { bare?: boolean; clip?: Buffer } = {}) {
  stand = await startComfyStandIn()
  const s = stand
  s.reply('GET /system_stats', { json: { system: { comfyui_version: '0.45.0' }, devices: [] } })
  for (const folder of opts.bare ? [] : new Set(spec.needs.models.map((m) => m.folder))) {
    const files = spec.needs.models.filter((m) => m.folder === folder).map((m) => m.file)
    s.reply(`GET /models/${folder}`, { json: files })
  }
  s.reply('GET /view', { body: opts.clip ?? CLIP })
  // As the real 0.45.0 server lists a clip: under images[], with an animated field beside it.
  const images = [{ filename: 'out.mp4', subfolder: 'adman', type: 'output' }]
  const status = { status_str: 'success', completed: true }
  s.reply(`GET /history/${ID}`, {
    json: { [ID]: { status, outputs: { [spec.slots.outputNode]: { images, animated: [true] } } } },
  })
  const printed: string[] = []
  const recorded = recordCalls(createComfyClient({ origin: s.origin, ownPorts: () => [] }))
  const kit: CaseKit = {
    client: recorded.client,
    print: makePrinter(s.origin, (line) => printed.push(line)),
    timing: { pollMs: 1, limitMs: 60_000, now: Date.now, sleep: () => Promise.resolve() },
    outDir: tempFolder('adman-comfy-case-'),
    env,
    newId: () => ID,
    fieldNames: { shown: false },
  }
  return { s, printed, recorded, kit }
}

const sentGraph = (s: StandIn) =>
  JSON.parse(s.seen.find((r) => r.path === '/prompt')?.body.toString() ?? '{}').prompt

const holdsAddress = (lines: string[], s: StandIn) =>
  lines.join('\n').includes('127.0.0.1') || lines.join('\n').includes(String(s.port))

describe('case 6, H3 from a first frame [SPEC 14 1.54 P-4, P-1; 1.58 J-1]', () => {
  it('runs only with ADMAN_COMFY_FRAME=1, and contacts nothing without it', async () => {
    const { s, kit } = await setUp({ ADMAN_COMFY_FRAME: 'yes', ADMAN_COMFY_VIDEO: '1' })
    expect(await firstFrameCase(kit)).toEqual({
      skip: 'ADMAN_COMFY_FRAME is not 1, so the first-frame video case does not run.',
    })
    expect(s.seen).toEqual([])
  })

  it('uploads the test-made picture, runs at 576 x 576 with 56 frames, and checks the clip', async () => {
    const { s, printed, recorded, kit } = await setUp(ON)
    expect(await firstFrameCase(kit)).toEqual({ done: true })
    const picture = Buffer.from(makeTestPicture())
    const upload = s.seen.filter((r) => r.path === '/upload/image')
    expect(upload).toHaveLength(1)
    expect(upload[0]?.body.includes(picture)).toBe(true)
    expect(upload[0]?.body.toString('latin1')).toContain(`filename="${uploadName(picture)}"`)
    const graph = sentGraph(s)
    expect(graph['15'].inputs.image).toBe(`adman/${uploadName(picture)}`)
    const inputs = graph['5'].inputs
    expect([inputs.width, inputs.height, inputs.length]).toEqual([576, 576, 56])
    expect(graph['14'].inputs.filename_prefix).toBe(`adman/${ID}`)
    expect(printed).toContain('Picture sent: the test-made picture, PNG, 768 x 768')
    expect(printed).toContain('Clip width: 576')
    expect(printed).toContain('Clip sound: yes')
    const written = printed.find((l) => l.startsWith('Written to: '))?.slice(12) ?? ''
    expect(written).toMatch(/\.mp4$/)
    expect(fs.readFileSync(written).equals(CLIP)).toBe(true)
    expect(foreignCancels(recorded.calls)).toEqual([])
    expect(holdsAddress(printed, s)).toBe(false)
  })

  it('sends only the given picture’s bytes, under the app-made name, never its path', async () => {
    const file = path.join(tempFolder('adman-given-folder-'), 'secret-product-shot.jpg')
    fs.writeFileSync(file, JPEG)
    const { s, printed, kit } = await setUp({ ...ON, ADMAN_COMFY_PICTURE: file })
    expect(await firstFrameCase(kit)).toEqual({ done: true })
    const upload = s.seen.find((r) => r.path === '/upload/image')?.body ?? Buffer.alloc(0)
    expect(upload.includes(JPEG)).toBe(true)
    expect(sentGraph(s)['15'].inputs.image).toBe(`adman/${uploadName(JPEG)}`)
    const everything = [
      ...s.seen.map((r) => `${r.path} ${JSON.stringify(r.headers)} ${r.body.toString('latin1')}`),
      ...printed,
    ].join('\n')
    for (const part of ['secret-product-shot', 'adman-given-folder-', file]) {
      expect(everything).not.toContain(part)
    }
    expect(printed).toContain('Picture sent: the given picture, JPEG, 800 x 600')
  })

  it('refuses a bad given picture before any call to the server', async () => {
    const { s, kit } = await setUp({ ...ON, ADMAN_COMFY_PICTURE: 'not/absolute.jpg' })
    await expect(firstFrameCase(kit)).rejects.toThrow(
      'ADMAN_COMFY_PICTURE must be an absolute path.',
    )
    expect(s.seen).toEqual([])
  })

  it('skips with one line when the check finds items missing, and uploads nothing', async () => {
    const { s, kit } = await setUp(ON, { bare: true })
    expect(await firstFrameCase(kit)).toEqual({
      skip: 'h3-image-to-video: 4 items missing, so it does not run.',
    })
    expect(s.seen.some((r) => r.path === '/upload/image' || r.path === '/prompt')).toBe(false)
  })

  it('fails with the checkMp4 reason when the clip is refused', async () => {
    const bad = Buffer.from(CLIP)
    bad.writeUInt32BE(0xffffffff, 0)
    const { kit, printed } = await setUp(ON, { clip: bad })
    await expect(firstFrameCase(kit)).rejects.toThrow(/^checkMp4 refused the clip: /)
    expect(printed.some((l) => l.startsWith('Written to: '))).toBe(false)
  })
})
