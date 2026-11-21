// S2-6: the address dialog and the licence dialog in the built app, offline, against the
// stand-in ComfyUI on 127.0.0.1 with the hand-test tools on. A run with no saved address asks
// for one and is sent again; an H3 video asks for the licence until the box is ticked.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import { makeSandbox, launch, type Sandbox } from './launch'
import { startComfyStandIn, type StandIn } from '../helpers/comfy-stand-in'
import { nthSentId, serveNeedsFromApp } from './stand-in-runs'
import * as screens from './screens'
import { answerQuit } from './quit-answer'

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
// The sandbox holds the saved address, so it is removed even if a close fails.
test.afterEach(async () => {
  try {
    if (app) await answerQuit(app)
    await app?.close()
    await stand?.close()
  } finally {
    fs.rmSync(box.root, { recursive: true, force: true })
  }
})

async function openCampaign(): Promise<void> {
  await screens.createProject(page, 'Summer Launch')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
}

const promptsSent = () => stand.seen.filter((r) => r.method === 'POST' && r.path === '/prompt')

test('Address dialog: Generate with ComfyUI and no address asks for it, and the run starts after saving', async () => {
  await openCampaign()
  // SP-5: this run is about the address, so the subject's photo is not sent.
  await screens.untickReferences(page)
  await screens.chooseProvider(page, 'ComfyUI')
  await screens.chooseSlot(page)
  await screens.setPrompt(page, screens.E2E_PROMPT)
  await screens.setCount(page, 1)
  await screens.generate(page)

  const dialog = page.getByRole('dialog', { name: "Enter your ComfyUI server's address" })
  await expect(dialog).toBeVisible()
  const field = dialog.getByLabel('Server address')
  await expect(field).toBeFocused()
  await expect(screens.runRows(page)).toHaveCount(0)
  await field.fill(stand.origin)
  await dialog.getByRole('button', { name: 'Save and continue' }).click()
  await expect(dialog).toBeHidden()
  await nthSentId(stand, 1)
  await expect(screens.runRows(page)).toHaveCount(1)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('Licence dialog: Cancel starts nothing; Confirm with the box ticked starts the video; the next start does not ask', async () => {
  const comfy = await screens.openSettings(page)
  await screens.saveAddress(comfy, stand.origin)
  await openCampaign()
  const dialog = screens.licenceDialog(page)
  const box = dialog.getByRole('checkbox', { name: "don't show again for MiniMax H3" })

  await screens.startVideo(page, 2)
  await expect(dialog).toHaveAccessibleName(
    'MiniMax H3 requires a commercial license, please confirm that you have one before production use',
  )
  await expect(box).toBeFocused()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
  await expect(screens.runRows(page)).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(promptsSent()).toEqual([])

  await screens.startVideo(page, 2)
  await box.check()
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  await expect(dialog).toBeHidden()
  await nthSentId(stand, 1)
  await expect(screens.runRows(page)).toHaveCount(1)

  await screens.startVideo(page, 2)
  await nthSentId(stand, 2)
  await expect(screens.runRows(page)).toHaveCount(2)
  await expect(dialog).toHaveCount(0)
})
