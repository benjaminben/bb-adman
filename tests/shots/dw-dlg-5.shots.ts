// DLG-5 (spec/phases/design-wave-screens-b.md, "DLG-5 — Pick dialogs"): the three pick
// dialogs. 481: "Layout…" on the master with two layers locked (five previews, the "2 kept"
// mark). 482: the reference dialog with three pictures ticked in order. 483: the picture
// chooser with a few imported pictures and the brief's subject photo. Made-up words and drawn
// colour pictures only; nothing is generated.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { makePng } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

// A still window (reduce motion, a fixed Math.random), a project and the brief's campaign,
// its master open in the editor.
async function campaign(s: Session): Promise<void> {
  const { app, page } = s
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await screens.createProject(page, 'Harbour Lights')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  await screens.openMaster(page)
}

// Two colours blended from top to bottom, as BGRA bytes.
function blend(top: number[], foot: number[], width = 120, height = 90): number[] {
  const bgra: number[] = []
  for (let y = 0; y < height; y += 1) {
    const t = y / height
    const px = top.map((c, i) => Math.round(c + ((foot[i] ?? c) - c) * t))
    for (let x = 0; x < width; x += 1) bgra.push(px[2]!, px[1]!, px[0]!, 255)
  }
  return bgra
}

const PICTURES: [string, number[], number[]][] = [
  ['harbour-dusk.png', [40, 60, 120], [230, 140, 70]],
  ['lantern-glow.png', [250, 200, 90], [150, 60, 30]],
  ['sea-wall.png', [90, 140, 160], [30, 50, 70]],
  ['night-boats.png', [20, 30, 60], [70, 90, 150]],
]

async function drawPictures(app: ElectronApplication, root: string): Promise<string[]> {
  const files: string[] = []
  for (const [name, top, foot] of PICTURES) {
    const file = path.join(root, name)
    fs.writeFileSync(file, await makePng(app, { width: 120, height: 90, bgra: blend(top, foot) }))
    files.push(file)
  }
  return files
}

async function still(page: Page, name: string): Promise<void> {
  await page.mouse.move(4, 4)
  await page.waitForTimeout(400)
  await shot(page, name)
}

test('481 the layout dialog with two layers locked', async () => {
  test.setTimeout(150_000)
  session = await openApp()
  const { page } = session
  await campaign(session)
  for (let i = 0; i < 2; i += 1) {
    await page
      .getByRole('button', { name: /^Lock / })
      .first()
      .click()
  }
  await expect(page.getByRole('button', { name: /^Unlock / })).toHaveCount(2)
  await page.getByRole('button', { name: 'Layout…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Choose a layout' })
  await expect(dialog.locator('[data-layout-preview]')).toHaveCount(5)
  await expect(dialog.getByText('2 kept')).toBeVisible()
  await still(page, '481-layout-dialog')
})

test('482 the reference dialog with three pictures ticked', async () => {
  test.setTimeout(150_000)
  session = await openApp()
  const { app, page, box } = session
  await campaign(session)
  await page.getByRole('button', { name: 'Add picture layer' }).click()
  const panel = screens.picturePanel(page)
  await expect(panel.getByRole('textbox', { name: 'Prompt' })).toBeEnabled()
  const files = await drawPictures(app, box.root)
  await panel.getByRole('button', { name: 'Choose reference pictures…' }).click()
  const dialog = page.getByRole('dialog', { name: /^Reference pictures for / })
  const library = dialog.getByRole('region', { name: 'Reference pictures' })
  await screens.answerOpenDialog(app, files)
  await library.getByRole('button', { name: 'Add pictures' }).click()
  await expect(library.getByRole('checkbox')).toHaveCount(5)
  const ticked = library.getByRole('checkbox', { checked: true })
  while ((await ticked.count()) > 0) await ticked.first().uncheck()
  for (const name of ['lantern-glow.png', 'harbour-dusk.png', 'night-boats.png']) {
    await library.getByRole('checkbox', { name, exact: true }).check()
  }
  await expect(dialog.getByText('3 / 8')).toBeVisible()
  await still(page, '482-reference-dialog')
})

test('483 the picture chooser', async () => {
  test.setTimeout(150_000)
  session = await openApp()
  const { app, page, box } = session
  await campaign(session)
  await page.getByRole('button', { name: 'Add picture layer' }).click()
  const files = await drawPictures(app, box.root)
  const properties = page.getByRole('region', { name: 'Properties' })
  await properties.getByRole('button', { name: 'Choose picture…' }).click()
  const chooser = page.getByRole('dialog', { name: /^Choose a picture for / })
  await screens.answerOpenDialog(app, files)
  await chooser.getByRole('button', { name: 'Import pictures…' }).last().click()
  await expect(chooser.getByRole('button', { name: 'sea-wall.png' })).toBeVisible()
  await still(page, '483-picture-chooser')
})
