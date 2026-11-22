// P5-19, Phase 5 exit criteria 2, 4 and 6: workflow 5.4 (a second creative direction) end to end
// in the built app with ADMAN_FAKE_PROVIDERS=1. "New direction…" named Studio;
// another background picture in its master; fan-out with one size on "Generate fill" (the fake
// provider); the fill placed; Cmd-click opens a tab behind; quick look Next; delete a variant,
// and the campaign's Undo does not bring it back [D-099]. No paid call. Made-up names only.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from './screens'
import { makeSandbox, launch, type Sandbox } from './launch'
import { makePng, query } from './render-helpers'
import { placeOf } from './workflow-5-1-steps'
import * as v from './variants-steps'

const STUDIO = 'Studio'
const TALL = '9x16 (1080×1920)'

let box: Sandbox
let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  box = makeSandbox()
  app = await launch(box)
  page = await app.firstWindow()
})
test.afterEach(async () => {
  try {
    await app?.close()
  } finally {
    fs.rmSync(box.root, { recursive: true, force: true })
  }
})

// 160 by 200: a deep green at the top fading to a pale sand at the foot.
async function drawnPicture(): Promise<string> {
  const bgra: number[] = []
  for (let y = 0; y < 200; y += 1) {
    const t = y / 200
    for (let x = 0; x < 160; x += 1) bgra.push(60 + 120 * t, 110 + 100 * t, 40 + 190 * t, 255)
  }
  const file = path.join(box.root, 'studio-backdrop.png')
  fs.writeFileSync(file, await makePng(app, { width: 160, height: 200, bgra }))
  return file
}

async function choosePicture(file: string): Promise<void> {
  const panel = page.getByRole('region', { name: 'Properties' })
  await panel.getByRole('button', { name: 'Choose picture…' }).click()
  const chooser = page.getByRole('dialog', { name: /^Choose a picture for / })
  await screens.answerOpenDialog(app, [file])
  await chooser.getByRole('button', { name: 'Import pictures…' }).click()
  await chooser.getByRole('button', { name: /studio-backdrop/ }).click()
  await expect(chooser).toHaveCount(0)
}

type Job = { kind: string; status: string; variantId: string; result: { assetIds: string[] } }

test('Workflow 5.4: a second direction, a fill on fan-out, tab behind, quick look, delete', async () => {
  test.setTimeout(180_000)
  await screens.createProject(page, 'Orchard')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  const place = await placeOf(page, screens.E2E_CAMPAIGN)

  // "New direction…" named Studio: two grids show.
  await v.directionMore(page, 'Direction 1', 'New direction…')
  const make = page.getByRole('dialog', { name: 'New direction' })
  await make.getByRole('textbox', { name: 'Name' }).fill(STUDIO)
  await make.getByRole('button', { name: 'Make direction' }).click()
  await expect(make).toBeHidden()
  await expect(page.getByRole('list', { name: /^Variants in / })).toHaveCount(2)
  await expect(v.grid(page, STUDIO).getByRole('listitem')).toHaveCount(1)

  // In the new master, another background picture.
  await v.editLayer(page, v.tile(page, STUDIO, '· master'), 'Background')
  await choosePicture(await drawnPicture())
  await v.showOverview(page)

  // Fan out Studio with the tall size on "Generate fill", the fake provider.
  await v.fanOut(page, STUDIO, { sizes: [TALL], fill: TALL })
  await expect(v.grid(page, STUDIO).getByRole('listitem')).toHaveCount(2)
  const tall = v.tile(page, STUDIO, '1080×1920 · en')
  await expect(tall.getByTitle('New result')).toBeVisible({ timeout: 60_000 })
  const thumb = tall.locator('img')
  await expect
    .poll(() => thumb.evaluate((i: HTMLImageElement) => i.naturalWidth))
    .toBeGreaterThan(0)

  // The fill is placed on that size's background.
  const { variants } = await v.campaignRead(page, place)
  const tallId = variants.find((r) => r.sizeLabel === '9x16')!.id
  const jobs = (await query(page, 'job.list', { projectId: place.projectId })) as unknown as Job[]
  const fill = jobs.find((j) => j.kind === 'generative_fill')
  expect(fill?.status).toBe('succeeded')
  await expect
    .poll(async () => (await v.layerOf(page, place.projectId, tallId, 'background'))?.source)
    .toEqual({ assetId: fill?.result.assetIds[0] })

  // Cmd-click (Ctrl-click on Windows) opens the tile's tab behind the overview.
  await v.tileButton(tall).click({ modifiers: ['ControlOrMeta'] })
  const tabs = page.getByRole('tablist', { name: 'Campaign' })
  await expect(tabs.getByRole('tab', { name: /9x16 · en/ })).toHaveCount(1)
  const variantsTab = tabs.getByRole('tab', { name: 'Variants', exact: true })
  await expect(variantsTab).toHaveAttribute('aria-selected', 'true')

  // Quick look, Next once, then Previous.
  await v
    .grid(page, STUDIO)
    .getByRole('button', { name: /^Quick look at / })
    .first()
    .click()
  const look = page.getByRole('dialog')
  await expect(look.getByText('2 of 3')).toBeVisible()
  await look.getByRole('button', { name: 'Next' }).click()
  await expect(look.getByText('3 of 3')).toBeVisible()
  await look.getByRole('button', { name: 'Previous' }).click()
  await expect(look.getByText('2 of 3')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // Delete the tall variant: the warning, "Delete variant", and Undo does not bring it back.
  const title = await v.tileMore(page, tall, 'Delete…')
  const warning = page.getByRole('dialog', { name: `Delete ${title}?` })
  await expect(warning.getByText('This cannot be undone.')).toBeVisible()
  await warning.getByRole('button', { name: 'Delete variant' }).click()
  await expect(warning).toBeHidden()
  await expect(v.grid(page, STUDIO).getByRole('listitem')).toHaveCount(1)
  const undo = page
    .getByRole('group', { name: 'Campaign changes' })
    .getByRole('button', { name: 'Undo' })
  await expect(undo).toBeDisabled()
  await expect(v.grid(page, STUDIO).getByRole('listitem')).toHaveCount(1)
  expect((await v.campaignRead(page, place)).variants.some((r) => r.id === tallId)).toBe(false)
})
