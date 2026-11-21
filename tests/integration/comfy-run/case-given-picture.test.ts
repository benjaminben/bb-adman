import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import { createComfyClient } from '../../../src/main/providers/comfyui/client'
import { uploadName } from '../../../src/main/providers/comfyui/values'
import { flux3KleinEditReferences as spec } from '../../../src/main/providers/comfyui/workflows/flux3'
import { makePrinter } from '../../comfy/print'
import { makeTestPicture } from '../../comfy/test-picture'
import { referenceCase, type CaseKit } from '../../comfy/cases'

const ID = '4d2c8a1f-3b6e-4f7a-9c0d-5e6f7a8b9c0d'
// A JPEG start and a baseline frame header: 800 wide, 600 high.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 2, 88, 3, 32, 3, 1, 0x22, 0, 0, 0])

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

// The given picture in its own temp folder, never the case's output folder.
function givenFile(): string {
  const file = path.join(tempFolder('adman-given-folder-'), 'secret-product-shot.jpg')
  fs.writeFileSync(file, JPEG)
  return file
}

// A stand-in where everything Flux needs is there, and the run ends with one PNG.
async function setUp(env: Record<string, string>) {
  stand = await startComfyStandIn()
  const s = stand
  s.reply('GET /system_stats', { json: { system: { comfyui_version: '0.45.0' }, devices: [] } })
  for (const folder of new Set(spec.needs.models.map((m) => m.folder))) {
    const files = spec.needs.models.filter((m) => m.folder === folder).map((m) => m.file)
    s.reply(`GET /models/${folder}`, { json: files })
  }
  s.reply('GET /view', { body: Buffer.from(makeTestPicture()) })
  const images = [{ filename: 'out.bin', subfolder: '', type: 'temp' }]
  const status = { status_str: 'success', completed: true }
  s.reply(`GET /history/${ID}`, {
    json: { [ID]: { status, outputs: { [spec.slots.outputNode]: { images } } } },
  })
  const printed: string[] = []
  const kit: CaseKit = {
    client: createComfyClient({ origin: s.origin, ownPorts: () => [] }),
    print: makePrinter(s.origin, (line) => printed.push(line)),
    timing: { pollMs: 1, limitMs: 60_000, now: Date.now, sleep: () => Promise.resolve() },
    outDir: tempFolder('adman-comfy-case-'),
    env,
    newId: () => ID,
    fieldNames: { shown: false },
  }
  return { s, printed, kit }
}

describe('case 5 with ADMAN_COMFY_PICTURE [SPEC 14 1.54 P-1, P-3]', () => {
  it('sends only its bytes, under the app-made name, and never its path or name', async () => {
    const file = givenFile()
    const { s, printed, kit } = await setUp({ ADMAN_COMFY_FLUX: '1', ADMAN_COMFY_PICTURE: file })
    expect(await referenceCase(kit)).toEqual({ done: true })
    const upload = s.seen.filter((r) => r.path === '/upload/image')
    expect(upload).toHaveLength(1)
    const body = upload[0]?.body ?? Buffer.alloc(0)
    expect(body.includes(JPEG)).toBe(true)
    expect(body.toString('latin1')).toContain(`filename="${uploadName(JPEG)}"`)
    const sent = JSON.parse(s.seen.find((r) => r.path === '/prompt')?.body.toString() ?? '{}')
    expect(sent.prompt['10'].inputs.image).toBe(`adman/${uploadName(JPEG)}`)
    const everything = [
      ...s.seen.map((r) => `${r.path} ${JSON.stringify(r.headers)} ${r.body.toString('latin1')}`),
      ...printed,
    ].join('\n')
    for (const part of ['secret-product-shot', 'adman-given-folder-', file]) {
      expect(everything).not.toContain(part)
    }
    expect(printed).toContain('Picture sent: the given picture, JPEG, 800 x 600')
    expect(printed.some((l) => l.startsWith('No JPEG run is made'))).toBe(false)
  })

  it('says the test-made picture was sent when the variable is not set', async () => {
    const { printed, kit } = await setUp({ ADMAN_COMFY_FLUX: '1' })
    expect(await referenceCase(kit)).toEqual({ done: true })
    expect(printed).toContain('Picture sent: the test-made picture, PNG, 768 x 768')
  })

  it('refuses a bad given picture before any call to the server', async () => {
    const { s, kit } = await setUp({
      ADMAN_COMFY_FLUX: '1',
      ADMAN_COMFY_PICTURE: 'not/absolute.jpg',
    })
    await expect(referenceCase(kit)).rejects.toThrow(
      'ADMAN_COMFY_PICTURE must be an absolute path.',
    )
    expect(s.seen).toEqual([])
  })
})
