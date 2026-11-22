import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'
import {
  command,
  FONT_FILE,
  inRenderWindow,
  projectWithFont,
  renderVariant,
  windows,
} from './render-helpers'

let box: Sandbox
test.beforeEach(() => {
  box = makeSandbox()
})
test.afterEach(() => fs.rmSync(box.root, { recursive: true, force: true }))

// spec/scene.md "The render window"; spec/security.md "Rules: the render window" [P3-6].
test('the hidden render window draws a variant and ends with the app window', async () => {
  const font = path.join(box.root, 'brand.woff2')
  fs.copyFileSync(FONT_FILE, font)
  const app = await launch(box)
  const page = await app.firstWindow()
  const ids = await projectWithFont(page, box.projects, font)
  // One app window, and no other window is shown. The app window is found by its page, not by
  // being shown: test launches keep it hidden (ADMAN_QUIET_WINDOWS). The hidden render window
  // may already be opening here: the app draws a thumbnail about a second after the variant
  // is made, so its count is not fixed.
  const early = await windows(app)
  expect(early.filter((w) => w.url.endsWith('/index.html'))).toHaveLength(1)
  expect(early.filter((w) => w.visible && !w.url.endsWith('/index.html'))).toEqual([])

  // A draw gives a PNG of the asked size: 1200 by 800 at a longer side of 300.
  const drawn = await renderVariant(page, { ...ids, maxDimension: 300 })
  expect(drawn).toEqual({
    signature: 'PNG',
    width: 300,
    height: 200,
    pngWidth: 300,
    pngHeight: 200,
  })
  const all = await windows(app)
  expect(all).toHaveLength(2)
  expect(all.find((w) => w.url.endsWith('/render.html'))?.visible).toBe(false)

  // Its page has no window.api; window.renderApi has exactly onRequest and done.
  expect(await inRenderWindow(app, `typeof window.api`)).toBe('undefined')
  expect(await inRenderWindow(app, `Object.keys(window.renderApi).sort()`)).toEqual([
    'done',
    'onRequest',
  ])

  // The policy keeps page script from reading an asset with fetch.
  const address = `adman-asset://${ids.projectId}/${ids.fontId}`
  const fetched = `fetch(${JSON.stringify(address)}).then(() => 'read', () => 'refused')`
  expect(await inRenderWindow(app, fetched)).toBe('refused')

  // An imported font loads in the Scene: a text layer that uses it, drawn again.
  await command(page, 'layer.create', {
    projectId: ids.projectId,
    variantId: ids.variantId,
    type: 'text',
    values: { copy: 'Brand', style: { fontAssetId: ids.fontId } },
  })
  const again = await renderVariant(page, { ...ids, maxDimension: 300 })
  expect(again).toMatchObject({ pngWidth: 300, pngHeight: 200 })
  const faces = `[...document.fonts].filter((f) => f.family.includes(${JSON.stringify(ids.fontId)})).map((f) => f.status)`
  expect(await inRenderWindow(app, faces)).toEqual(['loaded'])
  const late = await windows(app)
  expect(late.filter((w) => w.url.endsWith('/index.html'))).toHaveLength(1)
  expect(late.find((w) => w.url.endsWith('/render.html'))?.visible).toBe(false)

  // Closing the app window ends the render window first, so the app quits.
  const closed = app.waitForEvent('close')
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => !w.webContents.getURL().endsWith('/render.html'))
      ?.close(),
  )
  await closed
})
