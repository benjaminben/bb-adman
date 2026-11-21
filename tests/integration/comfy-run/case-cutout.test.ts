// P4-9: test:comfy case 8, the cut-out on birefnet-cutout, against the stand-in. It runs only
// with ADMAN_COMFY_CUTOUT=1; it uploads the test-made picture's bytes under uploadName, sends
// the shipped graph with that name at node 1, and passes on a PNG of colour type 6. It prints
// how many pixels are see-through, and never the address.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { describe, it, expect, afterEach } from 'vitest'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import { createComfyClient } from '@/main/providers/comfyui/client'
import { uploadName } from '@/main/providers/comfyui/values'
import { birefnetCutout as spec } from '@/main/providers/comfyui/workflows/birefnet'
import { greyPng } from '@/main/providers/fake/png'
import { recordCalls } from '../../comfy/recorder'
import { makePrinter } from '../../comfy/print'
import { makeTestPicture } from '../../comfy/test-picture'
import { cutoutCase, type CaseKit } from '../../comfy/cases'

let stand: StandIn | undefined
let outDir = ''
afterEach(async () => {
  await stand?.close()
  stand = undefined
  if (outDir) fs.rmSync(outDir, { recursive: true, force: true })
  outDir = ''
})

const ID = '3c9e1d2a-5b6f-4a70-8c1d-2e3f4a5b6c7d'

// A 4 × 2 RGBA PNG: the left half solid, the right half see-through but for one partly
// see-through pixel.
function rgbaPng(): Uint8Array {
  const alphas = [
    [255, 255, 0, 0],
    [255, 255, 128, 0],
  ]
  const raw = Buffer.concat(
    alphas.map((row) => Buffer.from([0, ...row.flatMap((a) => [9, 9, 9, a])])),
  )
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(8)
    head.writeUInt32BE(data.length, 0)
    head.write(type, 4, 'ascii')
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(zlib.crc32(Buffer.concat([head.subarray(4), data])), 0)
    return Buffer.concat([head, data, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(4, 0)
  ihdr.writeUInt32BE(2, 4)
  ihdr.set([8, 6, 0, 0, 0], 8)
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const parts = [signature, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw))]
  return new Uint8Array(Buffer.concat([...parts, chunk('IEND', Buffer.alloc(0))]))
}

async function setUp(env: Record<string, string>, result: Uint8Array = rgbaPng()) {
  stand = await startComfyStandIn()
  const s = stand
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-comfy-cutout-'))
  s.reply('GET /system_stats', { json: { system: { comfyui_version: '0.45.0' }, devices: [] } })
  s.reply('GET /models/background_removal', { json: ['birefnet.safetensors'] })
  s.reply('GET /view', { body: result, headers: { 'content-type': 'image/png' } })
  const images = [{ filename: 'out.png', subfolder: '', type: 'temp' }]
  const entry = { status: { status_str: 'success', completed: true }, outputs: { '6': { images } } }
  s.reply(`GET /history/${ID}`, { json: { [ID]: entry } })
  const printed: string[] = []
  const recorded = recordCalls(createComfyClient({ origin: s.origin, ownPorts: () => [] }))
  const kit: CaseKit = {
    client: recorded.client,
    print: makePrinter(s.origin, (line) => printed.push(line)),
    timing: { pollMs: 1, limitMs: 60_000, now: Date.now, sleep: () => Promise.resolve() },
    outDir,
    env,
    newId: () => ID,
    fieldNames: { shown: true },
  }
  return { s, printed, kit }
}

const holdsAddress = (lines: string[], s: StandIn) =>
  lines.join('\n').includes('127.0.0.1') || lines.join('\n').includes(String(s.port))

describe('test:comfy case 8, the cut-out [P4-9, D-092]', () => {
  it('runs only with ADMAN_COMFY_CUTOUT=1, and contacts nothing without it', async () => {
    const { s, kit } = await setUp({ ADMAN_COMFY_CUTOUT: 'yes' })
    expect(await cutoutCase(kit)).toEqual({
      skip: 'ADMAN_COMFY_CUTOUT is not 1, so the cut-out case does not run.',
    })
    expect(s.seen).toEqual([])
  })

  it('skips with the missing items by name, and sends no picture', async () => {
    const { s, kit, printed } = await setUp({ ADMAN_COMFY_CUTOUT: '1' })
    s.reply('GET /models/background_removal', { json: [] })
    expect(await cutoutCase(kit)).toEqual({
      skip: 'birefnet-cutout: 1 items missing, so it does not run.',
    })
    expect(printed).toContain('  model file: background_removal/birefnet.safetensors')
    expect(s.seen.some((r) => r.method === 'POST')).toBe(false)
  })

  it('sends the test-made picture under uploadName and the shipped graph with its name', async () => {
    const { s, kit } = await setUp({ ADMAN_COMFY_CUTOUT: '1' })
    expect(await cutoutCase(kit)).toEqual({ done: true })
    const upload = s.seen.find((r) => r.path === '/upload/image')
    const picture = makeTestPicture()
    expect(upload?.body.toString('latin1')).toContain(`filename="${uploadName(picture)}"`)
    const sent = s.seen.find((r) => r.path === '/prompt')?.body.toString('utf8') ?? '{}'
    const expected = structuredClone(spec.graph)
    expected['1'] = { class_type: 'LoadImage', inputs: { image: `adman/${uploadName(picture)}` } }
    expect((JSON.parse(sent) as { prompt: unknown }).prompt).toEqual(expected)
  })

  it('passes on a colour type 6 PNG and prints size, time and see-through pixels', async () => {
    const { s, kit, printed } = await setUp({ ADMAN_COMFY_CUTOUT: '1' })
    await cutoutCase(kit)
    expect(printed).toContain('PNG colour type: 6 (red, green, blue, alpha)')
    expect(printed).toContain('Pixel size: 4 x 2')
    expect(printed).toContain('See-through pixels: 3 of 8, partly see-through: 1')
    expect(printed.some((l) => l.startsWith('Time waiting: '))).toBe(true)
    const written = printed.find((l) => l.startsWith('Written to: '))?.slice(12) ?? ''
    expect(path.dirname(written)).toBe(outDir)
    expect(fs.readFileSync(written)).toEqual(Buffer.from(rgbaPng()))
    expect(holdsAddress(printed, s)).toBe(false)
  })

  it('fails on a PNG with no alpha channel', async () => {
    const { kit } = await setUp({ ADMAN_COMFY_CUTOUT: '1' }, greyPng(4, 4))
    await expect(cutoutCase(kit)).rejects.toThrow(/no alpha channel/)
  })
})
