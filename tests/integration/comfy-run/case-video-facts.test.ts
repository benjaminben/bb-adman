import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { startComfyStandIn, type Reply, type StandIn } from '../../helpers/comfy-stand-in'
import { createComfyClient } from '../../../src/main/providers/comfyui/client'
import { h3TextToVideo } from '../../../src/main/providers/comfyui/workflows/h3'
import { box, ftyp, mp4File } from '../../../src/main/providers/fake/mp4'
import { makePrinter } from '../../comfy/print'
import { videoCase, type CaseKit } from '../../comfy/cases'
import { clipFactLines } from '../../comfy/video-facts'

let stand: StandIn | undefined
let outDir = ''
afterEach(async () => {
  await stand?.close()
  stand = undefined
  if (outDir) fs.rmSync(outDir, { recursive: true, force: true })
  outDir = ''
})

const ID = '0b6f2c1e-7a3d-4c5b-9e8f-1a2b3c4d5e6f'

async function setUp() {
  stand = await startComfyStandIn()
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-comfy-video-'))
  const printed: string[] = []
  const kit: CaseKit = {
    client: createComfyClient({ origin: stand.origin, ownPorts: () => [] }),
    print: makePrinter(stand.origin, (line) => printed.push(line)),
    timing: { pollMs: 1, limitMs: 60_000, now: Date.now, sleep: () => Promise.resolve() },
    outDir,
    env: { ADMAN_COMFY_VIDEO: '1' },
    newId: () => ID,
    fieldNames: { shown: false },
  }
  return { s: stand, printed, kit }
}

// Everything H3 needs is there, and the run ends with this one file.
function complete(s: StandIn, file: Reply): void {
  s.reply('GET /system_stats', { json: { system: { comfyui_version: '0.45.0' }, devices: [] } })
  const spec = h3TextToVideo
  for (const folder of new Set(spec.needs.models.map((m) => m.folder))) {
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

const FACT_LINES = (lines: string[]) => lines.filter((l) => l.startsWith('Clip '))

describe('case 2 passes its clip through checkMp4 [SPEC 14 1.58 J-1]', () => {
  it('prints the width, height, duration and sound checkMp4 read from the clip', async () => {
    const { s, printed, kit } = await setUp()
    const clip = mp4File({ width: 576, height: 576, durationMs: 2_333, sound: true })
    complete(s, { body: Buffer.from(clip) })
    expect(await videoCase(kit)).toEqual({ done: true })
    expect(FACT_LINES(printed)).toEqual([
      'Clip width: 576',
      'Clip height: 576',
      'Clip duration: 2333 ms',
      'Clip sound: yes',
    ])
    expect(printed.some((l) => l.startsWith('Written to: '))).toBe(true)
  })

  it('fails with the refusal reason when checkMp4 refuses a clip that starts with ftyp', async () => {
    const { s, printed, kit } = await setUp()
    complete(s, { body: Buffer.from([...ftyp(), ...box('mdat', new Uint8Array(16))]) })
    await expect(videoCase(kit)).rejects.toThrow('checkMp4 refused the clip: noVideo')
    expect(printed).toContain('checkMp4 refused the clip: noVideo')
    expect(FACT_LINES(printed)).toEqual([])
    expect(printed.some((l) => l.startsWith('Written to: '))).toBe(false)
  })

  it('prints "not read" for each fact checkMp4 does not return', () => {
    expect(clipFactLines({ width: 64, hasSound: false })).toEqual([
      'Clip width: 64',
      'Clip height: not read',
      'Clip duration: not read',
      'Clip sound: no',
    ])
  })
})
