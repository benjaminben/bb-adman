// P7-8, phase-07.md "Clips and the track", "Drawing": a 400 by 400 video variant of 4 s drawn
// with variant.render in the real render window. The clip under the time is drawn in place of
// the background layer's source; a gap is black; a video clip is seeked to its source time
// (inMs + t - startMs) before the draw settles. The reference cases compare with their stored
// pictures (ADMAN_UPDATE_REFERENCES=1 writes them).
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'
import { command, inRenderWindow, makePng, query, renderPng } from './render-helpers'
import { checkReference, decodePng, type Bitmap } from './reference-compare'
import { PICTURES } from './scene-cases'

const SIDE = 400
const CLIP = path.resolve('tests/fixtures/video/tiny.mp4')
const PLACED = { x: 50, y: 100, width: 300, height: 200, rotation: 0, crop: null }
const SHADE = { color: '#000000', from: 'bottom', strength: 0.8, reach: 0.6 }

let box: Sandbox
let app: ElectronApplication
let page: Page
let projectId: string
let bands: string
let film: string

// A 4 s video variant with only a plain background layer, and no clips.
async function videoVariant(name: string, style: Record<string, unknown> = {}): Promise<string> {
  const { variantId } = await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: name,
      region: 'US',
      audience: 'All',
      message: 'Hi',
      subjects: [{ name }],
    },
    subjectMap: [{ subjectId: name, create: true }],
    languages: ['en'],
    sizes: [{ label: `${SIDE}x${SIDE}`, width: SIDE, height: SIDE }],
    templateId: 'starter',
  })
  const id = variantId as string
  const { layers } = await query(page, 'variant.get', { projectId, variantId: id })
  for (const layer of layers as { id: string; type: string }[]) {
    if (layer.type !== 'background') {
      await command(page, 'layer.delete', { projectId, layerId: layer.id })
      continue
    }
    const patch = { style: { shade: null, ...style } }
    await command(page, 'layer.update', { projectId, layerId: layer.id, patch })
  }
  await command(page, 'variant.setFormat', { projectId, variantId: id, format: 'video' })
  await command(page, 'variant.update', { projectId, variantId: id, durationMs: 4000 })
  const { clips } = await query(page, 'variant.get', { projectId, variantId: id })
  for (const clip of (clips ?? []) as { id: string }[]) {
    await command(page, 'clip.remove', { projectId, clipId: clip.id })
  }
  return id
}

async function addClip(variantId: string, assetId: string, startMs: number, change = {}) {
  const added = await command(page, 'clip.add', { projectId, variantId, assetId, startMs })
  const clipId = added.clipId as string
  if (Object.keys(change).length > 0) {
    await command(page, 'clip.update', { projectId, clipId, ...change })
  }
  return clipId
}

// The app draws a thumbnail about a second after a change, in the same window. Let it finish
// first, so the page still holds this draw when the test reads it.
async function drawAt(variantId: string, timeMs: number): Promise<Buffer> {
  await page.waitForTimeout(1200)
  await expect
    .poll(async () => (await query(page, 'thumbnail.get', { projectId, variantId })).state)
    .toBe('ready')
  return renderPng(page, { projectId, variantId, maxDimension: SIDE, timeMs })
}

const rgbAt = (b: Bitmap, x: number, y: number) => {
  const i = (y * b.width + x) * 4
  return [b.pixels[i + 2]!, b.pixels[i + 1]!, b.pixels[i]!]
}

test.describe('the background track drawn [P7-8]', () => {
  test.beforeAll(async () => {
    test.setTimeout(180_000)
    box = makeSandbox()
    app = await launch(box)
    page = await app.firstWindow()
    projectId = (await command(page, 'project.create', { name: 'Track', location: box.projects }))
      .projectId as string
    const picture = path.join(box.root, 'bands.png')
    fs.writeFileSync(picture, await makePng(app, PICTURES.bands))
    const clip = path.join(box.root, 'tiny.mp4')
    fs.copyFileSync(CLIP, clip)
    const { assetIds } = await command(page, 'asset.import', {
      projectId,
      paths: [picture, clip],
      library: 'asset',
      copy: false,
    })
    ;[bands, film] = assetIds as [string, string]
  })

  test.afterAll(async () => {
    await app?.close()
    fs.rmSync(box.root, { recursive: true, force: true })
  })

  test('clip-still-placement: a still clip covers its own placement box', async () => {
    const variantId = await videoVariant('placement')
    await addClip(variantId, bands, 0, { placement: PLACED })
    const png = await drawAt(variantId, 500)
    const drawn = await decodePng(app, png)
    expect(rgbAt(drawn, 10, 10), 'outside the placement').toEqual([0, 0, 0])
    expect(rgbAt(drawn, 200, 200), 'inside the placement').not.toEqual([0, 0, 0])
    await checkReference(app, 'clip-still-placement', png)
  })

  test('clip-gap-black: a time between clips draws black', async () => {
    const variantId = await videoVariant('gap', { fillColor: '#2850DC' })
    await addClip(variantId, bands, 2000)
    const png = await drawAt(variantId, 500)
    const drawn = await decodePng(app, png)
    const lit = drawn.pixels.filter((v, i) => i % 4 !== 3 && v > 8)
    expect(lit.length, 'channels that are not black').toBe(0)
    await checkReference(app, 'clip-gap-black', png)
  })

  test('clip-shade-over-still: the background shade is drawn over a still clip', async () => {
    const variantId = await videoVariant('shade', { shade: SHADE })
    await addClip(variantId, bands, 0)
    const png = await drawAt(variantId, 500)
    const drawn = await decodePng(app, png)
    // The shade reaches 60 % up from the bottom: y 150 is clear, y 395 is near its strongest.
    const light = (x: number, y: number) => rgbAt(drawn, x, y).reduce((a, v) => a + v, 0)
    expect(light(30, 395), 'the band darker at the bottom').toBeLessThan(light(30, 150) - 100)
    await checkReference(app, 'clip-shade-over-still', png)
  })

  test('a video clip is drawn at its source time, within one frame', async () => {
    const variantId = await videoVariant('film')
    await addClip(variantId, film, 1000, { inMs: 200, outMs: 1000 })
    const png = await drawAt(variantId, 1500)
    const seconds = await inRenderWindow(app, `document.querySelector('video')?.currentTime`)
    expect(Math.abs((seconds as number) - 0.7), `source time ${seconds}`).toBeLessThan(1 / 24)
    // tiny.mp4 is solid 0x3366cc, give or take the video's colour conversion.
    const [r, g, b] = rgbAt(await decodePng(app, png), 200, 200)
    expect([r, g, b].map((v, i) => Math.abs(v! - [0x33, 0x66, 0xcc][i]!) < 16)).toEqual([
      true,
      true,
      true,
    ])
  })
})
