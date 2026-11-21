// spec/testing.md "Reference pictures" [P3-8]: each Phase 3 case is set up through window.api
// in the built app, drawn in the real render window and compared with its stored picture.
// ADMAN_UPDATE_REFERENCES=1 writes the pictures instead of comparing.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'
import { command, drawInRenderWindow, FONT_FILE, makePng, query, renderPng } from './render-helpers'
import { checkReference, decodePng, differingShare, type Bitmap } from './reference-compare'
import { CASES, PICTURES, SIDE, type CaseAssets, type SceneCase } from './scene-cases'

type Layer = { id: string; type: string }
type Asset = { id: string; kind: 'image' | 'font'; missing: boolean } & Record<string, unknown>

let box: Sandbox
let app: ElectronApplication
let page: Page
let projectId: string
let assets: CaseAssets

test.describe('Phase 3 cases, one app for all', () => {
  test.beforeAll(async () => {
    box = makeSandbox()
    app = await launch(box)
    page = await app.firstWindow()
    projectId = (
      await command(page, 'project.create', { name: 'Reference', location: box.projects })
    ).projectId as string
    const names = Object.keys(PICTURES) as (keyof typeof PICTURES)[]
    const paths: string[] = []
    for (const name of names) {
      const file = path.join(box.root, `${name}.png`)
      fs.writeFileSync(file, await makePng(app, PICTURES[name]))
      paths.push(file)
    }
    const font = path.join(box.root, 'brand.woff2')
    fs.copyFileSync(FONT_FILE, font)
    const { assetIds } = await command(page, 'asset.import', {
      projectId,
      paths: [...paths, font],
      library: 'asset',
      copy: false,
    })
    const ids = assetIds as string[]
    assets = Object.fromEntries([...names, 'font'].map((n, i) => [n, ids[i]])) as CaseAssets
  })

  test.afterAll(async () => {
    await app?.close()
    fs.rmSync(box.root, { recursive: true, force: true })
  })

  // A 400 by 400 variant holding only the case's layers over its background.
  async function setUp(c: SceneCase): Promise<string> {
    const { variantId } = await command(page, 'campaign.create', {
      projectId,
      brief: {
        campaignName: c.name,
        region: 'US',
        audience: 'All',
        message: 'Hello',
        subjects: [{ name: c.name }],
      },
      subjectMap: [{ subjectId: c.name, create: true }],
      languages: [c.language ?? 'en'],
      sizes: [{ label: `${SIDE}x${SIDE}`, width: SIDE, height: SIDE }],
      templateId: 'starter',
    })
    const { layers } = await query(page, 'variant.get', { projectId, variantId })
    for (const layer of layers as Layer[]) {
      if (layer.type === 'background' && c.background) {
        await command(page, 'layer.update', {
          projectId,
          layerId: layer.id,
          patch: c.background(assets),
        })
      } else if (layer.type !== 'background') {
        await command(page, 'layer.delete', { projectId, layerId: layer.id })
      }
    }
    for (const { type, values } of c.layers?.(assets) ?? []) {
      await command(page, 'layer.create', {
        projectId,
        variantId: variantId as string,
        type,
        values,
      })
    }
    return variantId as string
  }

  // The same input the render service builds (spec/scene.md "One draw"), in overlay-only mode.
  async function drawOverlayOnly(variantId: string): Promise<Buffer> {
    const got = await query(page, 'variant.get', { projectId, variantId })
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
      mode: 'overlay-only',
    }
    // The app draws a thumbnail of each variant about a second after its last change, in the
    // same window. Let those draws finish first: this one goes round the app's own queue.
    await page.waitForTimeout(1200)
    await expect
      .poll(async () => (await query(page, 'thumbnail.get', { projectId, variantId })).state)
      .toBe('ready')
    return drawInRenderWindow(app, {
      requestId: `overlay-${variantId}`,
      input,
      width: SIDE,
      height: SIDE,
    })
  }

  const alphaAt = (b: Bitmap, x: number, y: number) => b.pixels[(y * b.width + x) * 4 + 3]

  for (const c of CASES) {
    test(`${c.name}: ${c.title}`, async () => {
      test.fixme(c.fixme !== undefined, c.fixme)
      const variantId = await setUp(c)
      // A full draw first, so the render window exists and the case is known to draw.
      const full = await renderPng(page, { projectId, variantId, maxDimension: SIDE })
      const png = c.mode === 'overlay-only' ? await drawOverlayOnly(variantId) : full
      const drawn = await decodePng(app, png)
      expect([drawn.width, drawn.height]).toEqual([SIDE, SIDE])
      if (c.mode === 'overlay-only') {
        // The corner held only the background: in overlay-only mode it is see-through.
        expect(alphaAt(drawn, 2, 2), 'alpha of a corner pixel').toBe(0)
        // The left stroke of the "O" of "Over video" is drawn.
        expect(alphaAt(drawn, 90, 189), 'alpha inside the text').toBeGreaterThan(0)
      } else {
        // A full draw has a black root, so no pixel is see-through.
        const seeThrough = drawn.pixels.filter((_, i) => i % 4 === 3 && drawn.pixels[i] !== 255)
        expect(seeThrough.length, 'pixels of a full draw that are not opaque').toBe(0)
      }
      await checkReference(app, c.name, png)
    })
  }
})

// The tolerance itself: 0.5 % of pixels, a channel off by more than 8.
test('the compare rule allows small channel changes and few changed pixels only', () => {
  const plain = (fill: number): Bitmap => ({
    width: 20,
    height: 20,
    pixels: Buffer.alloc(20 * 20 * 4, fill),
  })
  const base = plain(100)
  expect(differingShare(base, plain(108))).toBe(0)
  expect(differingShare(base, plain(109))).toBe(1)
  const twoPixels = plain(100)
  twoPixels.pixels[0] = 0
  twoPixels.pixels[7] = 0
  expect(differingShare(base, twoPixels)).toBe(2 / 400)
  expect(differingShare(base, { ...plain(100), width: 10, height: 40 })).toBe(1)
})
