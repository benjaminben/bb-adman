// P8-19, from P8-14 [REQ: FR-131]: the same frame drawn twice gives the same picture, checked
// through a real video export. One video ad of 1,001 ms at 30 fps, a still clip under a text
// that fades in over the whole ad (so every frame differs from the one before and each is drawn),
// is exported twice with export.run from window.api, each time to its own temporary folder. Both
// MP4s hold ceil(1001 / 1000 × 30) = 31 frames, and every frame decoded from the first is byte
// for byte the frame decoded from the second. The fetched FFmpeg is needed; the test process
// runs it only to read the files back.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'
import { command, makePng, query } from './render-helpers'
import { PICTURES } from './scene-cases'
import { appWindow, filesUnder } from './publish-steps'
import * as ex from './export-steps'
import { FETCHED_FFMPEG, ffmpegFetched, frameCountOf } from './export-steps'

const SIDE = 320
const DURATION_MS = 1001
const FRAMES = 31

let box: Sandbox
let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  box = makeSandbox()
  app = await launch(box)
  page = await appWindow(app)
})
test.afterEach(async () => {
  try {
    await app?.close()
  } finally {
    fs.rmSync(box.root, { recursive: true, force: true })
  }
})

async function importPicture(projectId: string, name: keyof typeof PICTURES): Promise<string> {
  const file = path.join(box.root, `${name}.png`)
  fs.writeFileSync(file, await makePng(app, PICTURES[name]))
  const { assetIds } = await command(page, 'asset.import', {
    projectId,
    paths: [file],
    library: 'asset',
    copy: false,
  })
  return (assetIds as string[])[0]!
}

// A video ad with one still clip and a picture that fades in from 0 to the end.
async function videoAd() {
  const { projectId } = (await command(page, 'project.create', {
    name: 'Frames',
    location: box.projects,
  })) as { projectId: string }
  const bands = await importPicture(projectId, 'bands')
  const { campaignId, variantId } = (await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: 'Frames',
      region: 'US',
      audience: 'All',
      message: 'Hi',
      subjects: [{ name: 'Tin' }],
    },
    subjectMap: [{ subjectId: 'tin', create: true }],
    languages: ['en'],
    sizes: [{ label: `${SIDE}x${SIDE}`, width: SIDE, height: SIDE }],
    templateId: 'starter',
  })) as { campaignId: string; variantId: string }
  const { layers } = await query(page, 'variant.get', { projectId, variantId })
  for (const layer of layers as { id: string; type: string }[]) {
    if (layer.type !== 'background') {
      await command(page, 'layer.delete', { projectId, layerId: layer.id })
    }
  }
  await command(page, 'variant.setFormat', { projectId, variantId, format: 'video' })
  await command(page, 'variant.update', { projectId, variantId, durationMs: DURATION_MS })
  const { clips } = await query(page, 'variant.get', { projectId, variantId })
  for (const clip of (clips ?? []) as { id: string }[]) {
    await command(page, 'clip.remove', { projectId, clipId: clip.id })
  }
  await command(page, 'clip.add', { projectId, variantId, assetId: bands, startMs: 0 })
  const { layerId } = (await command(page, 'layer.create', {
    projectId,
    variantId,
    type: 'text',
    values: {
      copy: 'Fade in',
      geometry: { x: 40, y: 120, width: 240, height: 80, rotation: 0, crop: null },
    },
  })) as { layerId: string }
  const fade = { preset: 'fade', startMs: 0, durationMs: DURATION_MS }
  const patch = { animation: { entrance: fade } }
  await command(page, 'layer.update', { projectId, layerId, patch })
  return { place: { projectId, campaignId }, variantId }
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

// Every frame of the MP4, decoded by the fetched FFmpeg and written as one PNG each (the build
// has no raw video output), cut apart at each PNG signature.
function framesOf(file: string): Buffer[] {
  const out = spawnSync(
    FETCHED_FFMPEG,
    ['-v', 'error', '-i', file, '-f', 'image2pipe', '-c:v', 'png', 'pipe:1'],
    { maxBuffer: 64 * 1024 * 1024 },
  )
  expect(out.status, out.stderr.toString()).toBe(0)
  const starts: number[] = []
  for (let at = out.stdout.indexOf(PNG_SIGNATURE); at >= 0;) {
    starts.push(at)
    at = out.stdout.indexOf(PNG_SIGNATURE, at + 1)
  }
  return starts.map((at, i) => out.stdout.subarray(at, starts[i + 1] ?? out.stdout.length))
}

function exportedMp4(folder: string): string {
  const files = filesUnder(folder).filter((f) => f.endsWith('.mp4'))
  expect(files).toHaveLength(1)
  return path.join(folder, files[0]!)
}

test('a video ad exported twice gives the same frames, and ceil(duration × fps) of them [FR-131]', async () => {
  test.skip(!ffmpegFetched(), 'FFmpeg is not fetched.')
  test.setTimeout(240_000)
  const { place, variantId } = await videoAd()

  const files: string[] = []
  for (const name of ['first export', 'second export']) {
    const folder = ex.outputFolder(box.root, name)
    const end = await ex.exportByApi(page, place, [variantId], folder)
    expect(end.status).toBe('succeeded')
    expect(end.result).toMatchObject({ exported: 1, failed: 0 })
    files.push(exportedMp4(folder))
  }

  for (const file of files) expect(frameCountOf(fs.readFileSync(file))).toBe(FRAMES)
  const [first, second] = files.map(framesOf) as [Buffer[], Buffer[]]
  expect(first).toHaveLength(FRAMES)
  expect(second).toHaveLength(FRAMES)
  // The fade makes the frames differ from each other, so equal files are not one frame repeated.
  expect(first[0]!.equals(first[FRAMES - 1]!)).toBe(false)
  for (let i = 0; i < FRAMES; i++) {
    expect(first[i]!.equals(second[i]!), `frame ${i} of both exports`).toBe(true)
  }
})
