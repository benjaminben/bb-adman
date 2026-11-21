import { test, expect, type ElectronApplication } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'
import { command, FONT_FILE, projectWithFont, windows } from './render-helpers'

let box: Sandbox
test.beforeEach(() => {
  box = makeSandbox()
})
test.afterEach(() => fs.rmSync(box.root, { recursive: true, force: true }))

const FIXTURES = path.resolve('tests/fixtures/webp')
// 40 by 30, red at half transparency; 20 by 10, a blue frame then a green one.
const STILL = 'see-through-red.webp'
const ANIMATED = 'blue-then-green.webp'

// Runs page script in the decoder window, from the main process. Fails when there is none.
function inDecoderWindow(app: ElectronApplication, script: string): Promise<unknown> {
  return app.evaluate(({ BrowserWindow }, code) => {
    const win = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().endsWith('/webp.html'),
    )
    if (!win) throw new Error('There is no decoder window.')
    return win.webContents.executeJavaScript(code)
  }, script)
}

// The decoder page's PNG for one fixture: its size and first pixel, read in the main process.
function decode(app: ElectronApplication, name: string) {
  const base64 = fs.readFileSync(path.join(FIXTURES, name)).toString('base64')
  return app.evaluate(async ({ BrowserWindow, nativeImage }, b64) => {
    const win = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().endsWith('/webp.html'),
    )
    const png = (await win?.webContents.executeJavaScript(
      `window.admanDecodeWebp(${JSON.stringify(b64)})`,
    )) as Uint8Array
    const image = nativeImage.createFromBuffer(Buffer.from(png))
    const [b, g, r, a] = image.toBitmap().subarray(0, 4)
    return { signature: Buffer.from(png.subarray(1, 4)).toString(), ...image.getSize(), r, g, b, a }
  }, base64)
}

// Slice WP: a still and an animated WebP, through the real hidden window.
test('WebP references are taken and decoded to PNG by the hidden decoder window', async () => {
  for (const name of [STILL, ANIMATED])
    fs.copyFileSync(path.join(FIXTURES, name), path.join(box.root, name))
  fs.copyFileSync(FONT_FILE, path.join(box.root, 'brand.woff2'))
  const app = await launch(box)
  const page = await app.firstWindow()
  const ids = await projectWithFont(page, box.projects, path.join(box.root, 'brand.woff2'))
  const { assetIds } = await command(page, 'asset.import', {
    projectId: ids.projectId,
    paths: [STILL, ANIMATED].map((name) => path.join(box.root, name)),
    library: 'reference',
    copy: false,
  })
  expect(await windows(app)).toHaveLength(1)

  // The run is taken: both references were read, decoded and passed through toPng.
  const { jobId } = await command(page, 'generation.runImages', {
    projectId: ids.projectId,
    variantId: ids.variantId,
    slot: 'background',
    prompt: 'A can on a rock',
    referenceAssetIds: assetIds,
    count: 1,
    provider: 'fake',
  })
  expect(typeof jobId).toBe('string')
  const decoder = (await windows(app)).find((w) => w.url.endsWith('/webp.html'))
  expect(decoder?.visible).toBe(false)

  // Still: its size, transparency kept. Animated: the first frame, blue.
  expect(await decode(app, STILL)).toMatchObject({
    signature: 'PNG',
    width: 40,
    height: 30,
    a: 128,
  })
  expect(await decode(app, ANIMATED)).toEqual({
    signature: 'PNG',
    width: 20,
    height: 10,
    r: 0,
    g: 0,
    b: 255,
    a: 255,
  })

  // Its walls: no bridge, no Node, nothing goes out; the app window cannot reach it.
  expect(await inDecoderWindow(app, 'typeof window.api')).toBe('undefined')
  expect(await inDecoderWindow(app, 'typeof window.renderApi')).toBe('undefined')
  expect(await inDecoderWindow(app, 'typeof require + typeof process')).toBe('undefinedundefined')
  const out = `fetch('https://example.com/').then(() => 'sent', () => 'refused')`
  expect(await inDecoderWindow(app, out)).toBe('refused')
  expect(
    await page.evaluate(() => typeof (window as { admanDecodeWebp?: unknown }).admanDecodeWebp),
  ).toBe('undefined')

  // Closing the app window ends the decoder window too, so the app quits.
  const closed = app.waitForEvent('close')
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.isVisible())
      ?.close(),
  )
  await closed
})
