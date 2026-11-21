// SPEC 14 1.56 E2E-R, the offline spec: the built app driven through its screens against the
// stand-in ComfyUI on 127.0.0.1, with the hand-test tools on so trial workflows are offered.
// No real server, no paid provider and no network beyond 127.0.0.1 is reached: Gemini's paid
// confirm is only ever cancelled. The place for TP-6's video start is a further test here,
// once the video panel is built.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'
import { startComfyStandIn, type StandIn } from '../helpers/comfy-stand-in'
import { greyPng } from '../../src/main/providers/fake/png'
import {
  finishWithError,
  finishWithPicture,
  nthSentId,
  serveNeedsFromApp,
  startWorking,
} from './stand-in-runs'
import * as screens from './screens'
import { handTestStorage, projectHomeTour, settingsTour, startTour } from './screen-tour'

const MOSS_OUTPUT = '9'
const FLUX_OUTPUT = '15'

let box: Sandbox
let stand: StandIn
let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  box = makeSandbox()
  stand = await startComfyStandIn()
  app = await launch(box, [], { ADMAN_DEV_TOOLS: '1' })
  page = await app.firstWindow()
  await serveNeedsFromApp(page, stand)
})
// The sandbox holds the saved address and any typed key, so it is removed even if a close fails.
test.afterEach(async () => {
  try {
    await app?.close()
    await stand?.close()
  } finally {
    fs.rmSync(box.root, { recursive: true, force: true })
  }
})

// The project, the campaign from the test brief, and the stand-in's address saved.
async function campaignOnStandIn(): Promise<void> {
  const comfy = await screens.openSettings(page)
  await screens.saveAddress(comfy, stand.origin)
  await screens.createProject(page, 'Stand-in')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  await screens.chooseProvider(page, 'ComfyUI')
  await screens.setCount(page, 1)
}

const generate = () => screens.generate(page)

test('Settings: a refused address, then the stand-in saved, checked per workflow and removed', async () => {
  const comfy = await screens.openSettings(page)
  await comfy.getByLabel('Server address').fill('ftp://127.0.0.1:21')
  await comfy.getByRole('button', { name: 'Save' }).click()
  await expect(comfy.locator('#comfy-address-refusal')).toBeVisible()
  await expect(comfy.getByText('No address saved.')).toBeVisible()
  const banner = page.getByRole('alert')
  await expect(banner).toBeVisible()
  await banner.getByRole('button', { name: 'Dismiss' }).click()
  await expect(banner).toBeHidden()

  await screens.saveAddress(comfy, stand.origin)
  await screens.checkServer(comfy)
  await expect(screens.workflowRow(comfy, screens.MOSS_LABEL)).toContainText('Complete')
  await expect(screens.workflowRow(comfy, screens.FLUX_LABEL)).toContainText('Complete')
  // The check only asks: GETs and nothing else.
  expect(stand.seen.length).toBeGreaterThan(0)
  expect(stand.seen.filter((r) => r.method !== 'GET')).toEqual([])

  await comfy.getByRole('button', { name: 'Remove' }).click()
  await expect(comfy.getByText('No address saved.')).toBeVisible()
})

test('Campaign: a run waits, works and is done; a failed run is retried; a waiting run is cancelled', async () => {
  await campaignOnStandIn()

  await generate()
  const first = await nthSentId(stand, 1)
  await expect(screens.runRow(page)).toContainText(screens.WAITING_ON_SERVER)
  startWorking(stand, first)
  await expect(screens.runRow(page)).toContainText(screens.WORKING_ON_SERVER, {
    timeout: 15_000,
  })
  finishWithPicture(stand, first, MOSS_OUTPUT)
  await expect(screens.runRow(page)).toContainText('Done', { timeout: 15_000 })
  const picture = screens.runRow(page).getByRole('img', { name: 'Result 1' })
  await expect(picture).toBeVisible()
  expect(await picture.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)

  await generate()
  finishWithError(stand, await nthSentId(stand, 2))
  await expect(screens.runRow(page)).toContainText('Failed', { timeout: 15_000 })
  await screens.runRow(page).getByRole('button', { name: 'Retry' }).click()
  finishWithPicture(stand, await nthSentId(stand, 3), MOSS_OUTPUT)
  await expect(screens.runRow(page)).toContainText('Done', { timeout: 15_000 })

  await generate()
  await nthSentId(stand, 4)
  await expect(screens.runRow(page)).toContainText(screens.WAITING_ON_SERVER)
  await screens.runRow(page).getByRole('button', { name: 'Cancel' }).click()
  await expect(screens.runRow(page)).toContainText('Cancelled', { timeout: 15_000 })
})

test("References and the paid confirm: an added picture goes to Flux; Gemini's confirm is cancelled", async () => {
  await campaignOnStandIn()
  const file = path.join(box.root, 'reference.png')
  fs.writeFileSync(file, greyPng(32, 24))

  await screens.answerOpenDialog(app, [file])
  const references = page.getByRole('region', { name: 'Reference pictures' })
  await references.getByRole('button', { name: 'Add pictures' }).click()
  const tick = references.getByRole('checkbox')
  await expect(tick).toHaveCount(1)
  await tick.check()
  await generate()
  finishWithPicture(stand, await nthSentId(stand, 1), FLUX_OUTPUT)
  await expect(screens.runRow(page)).toContainText('Done', { timeout: 15_000 })
  expect(stand.seen.some((r) => r.method === 'POST' && r.path === '/upload/image')).toBe(true)

  await screens.chooseProvider(page, 'Google Gemini')
  await generate()
  const panel = screens.picturePanel(page)
  await expect(panel.getByText(/^This sends 1 paid request\(s\)/)).toBeVisible()
  await panel.getByRole('button', { name: 'Cancel' }).click()
  await expect(panel.getByRole('button', { name: 'Generate' })).toBeVisible()
  await expect(screens.runRows(page)).toHaveCount(1)
})

test('The other screens of the reach table: hand-test storage, Settings, Start, project home', async () => {
  await handTestStorage(page, box)
  await settingsTour(app, page, box)
  await startTour(app, page, box)
  await projectHomeTour(app, page)
})
