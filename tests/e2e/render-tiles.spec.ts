// P8-3 (phase-08.md "Drawing at full size"): a 3,000 by 1,000 variant is drawn in the real
// render window as two tiles at scale 1 (2,048 and 952 wide), joined here, and compared with the
// reference export-tiles-seam. The text and the background bands cross the 2,048 line: the joined
// picture must show no seam, gap or doubled column there.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'
import { command, drawInRenderWindow, makePng, query, renderPng } from './render-helpers'
import { checkReference, decodePng, type Bitmap } from './reference-compare'
import { PICTURES } from './scene-cases'

type Layer = { id: string; type: string }
type Asset = { id: string; kind: 'image' | 'font'; missing: boolean } & Record<string, unknown>

const WIDTH = 3000
const HEIGHT = 1000
const SPLIT = 2048

let box: Sandbox
test.beforeEach(() => {
  box = makeSandbox()
})
test.afterEach(() => fs.rmSync(box.root, { recursive: true, force: true }))

// Copies the two tiles' rows side by side into one bitmap of four bytes a pixel.
function join(left: Bitmap, right: Bitmap): Buffer {
  const out = Buffer.alloc(WIDTH * HEIGHT * 4)
  for (let y = 0; y < HEIGHT; y++) {
    left.pixels.copy(out, y * WIDTH * 4, y * left.width * 4, (y + 1) * left.width * 4)
    right.pixels.copy(out, (y * WIDTH + SPLIT) * 4, y * right.width * 4, (y + 1) * right.width * 4)
  }
  return out
}

// The rows of one column where the pixel is near white: the text, over the coloured bands.
const whiteRows = (b: Bitmap, x: number) =>
  Array.from({ length: b.height }, (_, y) => y).filter((y) => {
    const i = (y * b.width + x) * 4
    return b.pixels[i]! > 230 && b.pixels[i + 1]! > 230 && b.pixels[i + 2]! > 230
  })

test('a big variant drawn as two tiles joins with no seam at 2,048', async () => {
  const app = await launch(box)
  const page = await app.firstWindow()
  const { projectId } = await command(page, 'project.create', {
    name: 'Tiles',
    location: box.projects,
  })
  const file = path.join(box.root, 'bands.png')
  fs.writeFileSync(file, await makePng(app, PICTURES.bands))
  const { assetIds } = await command(page, 'asset.import', {
    projectId,
    paths: [file],
    library: 'asset',
    copy: false,
  })
  const { variantId } = await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: 'Wide banner',
      region: 'US',
      audience: 'All',
      message: 'Summer sale',
      subjects: [{ name: 'Banner' }],
    },
    subjectMap: [{ subjectId: 'banner', create: true }],
    languages: ['en'],
    sizes: [{ label: `${WIDTH}x${HEIGHT}`, width: WIDTH, height: HEIGHT }],
    templateId: 'starter',
  })
  const ids = { projectId: projectId as string, variantId: variantId as string }
  const { layers } = await query(page, 'variant.get', ids)
  for (const layer of layers as Layer[]) {
    if (layer.type !== 'background') {
      await command(page, 'layer.delete', { projectId, layerId: layer.id })
      continue
    }
    await command(page, 'layer.update', {
      projectId,
      layerId: layer.id,
      patch: { source: { assetId: (assetIds as string[])[0] }, style: { shade: null } },
    })
  }
  await command(page, 'layer.create', {
    ...ids,
    type: 'text',
    values: {
      copy: 'Summer sale across the line',
      geometry: { x: 1400, y: 380, width: 1400, height: 240, rotation: 0, crop: null },
      style: {
        fontAssetId: null,
        fontSize: 120,
        fontWeight: 700,
        color: '#FFFFFF',
        align: 'left',
        lineHeight: 1.2,
        letterSpacing: 0,
      },
    },
  })

  // A small draw first, so the render window exists; then let the app's own thumbnail finish.
  await renderPng(page, { ...ids, maxDimension: 300 })
  await page.waitForTimeout(1200)
  await expect.poll(async () => (await query(page, 'thumbnail.get', ids)).state).toBe('ready')

  const got = await query(page, 'variant.get', ids)
  const { width, height, language, format, durationMs } = got.variant as Record<string, unknown>
  const input = {
    projectId,
    variant: { width, height, language, format, durationMs },
    layers: got.layers,
    assets: Object.fromEntries(
      (got.assets as Asset[]).map((a) => [
        a.id,
        { kind: a.kind, missing: a.missing, width: a.width, height: a.height },
      ]),
    ),
    timeMs: 0,
    mode: 'full',
  }
  const tile = (x: number, w: number) =>
    drawInRenderWindow(app, {
      requestId: `tile-${x}`,
      input,
      width: w,
      height: HEIGHT,
      view: { x, y: 0 },
    })
  const left = await decodePng(app, await tile(0, SPLIT))
  const right = await decodePng(app, await tile(SPLIT, WIDTH - SPLIT))
  expect([left.width, left.height, right.width, right.height]).toEqual([
    SPLIT,
    HEIGHT,
    WIDTH - SPLIT,
    HEIGHT,
  ])

  // The text crosses the line: white pixels on both sides of it, in the same rows.
  const before = whiteRows(left, SPLIT - 1)
  const after = whiteRows(right, 0)
  expect(before.length, 'text pixels just left of the line').toBeGreaterThan(0)
  expect(after.length, 'text pixels just right of the line').toBeGreaterThan(0)

  const base64 = await app.evaluate(
    ({ nativeImage }, { bitmap, size }) =>
      nativeImage.createFromBitmap(Buffer.from(bitmap, 'base64'), size).toPNG().toString('base64'),
    { bitmap: join(left, right).toString('base64'), size: { width: WIDTH, height: HEIGHT } },
  )
  const joined = Buffer.from(base64, 'base64')
  await checkReference(app, 'export-tiles-seam', joined)
})
