import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'
import { command, FONT_FILE } from './render-helpers'

let box: Sandbox
test.beforeEach(() => {
  box = makeSandbox()
})
test.afterEach(() => fs.rmSync(box.root, { recursive: true, force: true }))

// P3-6 ruling on check (c): the adman-asset scheme has CORS on so a font can load, and the
// policy's connect-src 'none' still keeps page script from reading an asset with fetch.
test('the app window loads an imported font and cannot fetch an asset [P3-6]', async () => {
  const file = path.join(box.root, 'brand.woff2')
  fs.copyFileSync(FONT_FILE, file)
  const app = await launch(box)
  const page = await app.firstWindow()
  const { projectId } = await command(page, 'project.create', {
    name: 'Fonts',
    location: box.projects,
  })
  const { assetIds } = await command(page, 'asset.import', {
    projectId,
    paths: [file],
    library: 'asset',
    copy: false,
  })
  const address = `adman-asset://${projectId}/${(assetIds as string[])[0]}`

  const loaded = await page.evaluate(
    (url) =>
      new FontFace('brand-check', `url("${url}")`).load().then(
        (face) => face.status,
        () => 'error',
      ),
    address,
  )
  expect(loaded).toBe('loaded')

  const fetched = await page.evaluate(
    (url) =>
      fetch(url).then(
        () => 'read',
        () => 'refused',
      ),
    address,
  )
  expect(fetched).toBe('refused')
  await app.close()
})
