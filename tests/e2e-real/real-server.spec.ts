// SPEC 14 1.56 E2E-R: the built app driven through its screens on the stakeholder's real
// ComfyUI server. Run by hand only: `npm run test:e2e:real`, with the switches chosen for that
// run. The address, photo paths and key are never in a test name, a locator, a check on a value
// or a printed line; every step that holds them is guarded (guard.ts). The cases run only what
// they name and clear or delete nothing on the server. A cancel is only of the run the test
// itself started, by the run row's own Cancel.
// With no switch: Settings and Check, and the Gemini paid confirm cancelled (no request).
// TP-6's video case runs with ADMAN_E2E_VIDEO=1 and leaves one clip on the server.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import { makeSandbox, launchReal, type Sandbox } from '../e2e/launch'
import * as screens from '../e2e/screens'
import { guardedStep } from './guard'
import { realSwitches, videoSwitch } from './switches'
import * as real from './real-steps'

const switches = realSwitches(process.env)
// A real run can wait in the server's queue. Each wait below ends before this limit, so a
// slow run fails inside its guard and not on Playwright's own timeout.
const RUN_CASE_MS = 35 * 60_000
const RUN_WAIT_MS = 25 * 60_000
// The video run is allowed 15 minutes to finish; the case's limit leaves room for setup.
const VIDEO_WAIT_MS = 15 * 60_000
const VIDEO_CASE_MS = 20 * 60_000
const videoOn = videoSwitch(process.env)

let box: Sandbox
let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  box = makeSandbox()
  app = await launchReal(box)
  page = await app.firstWindow()
})
// The sandbox holds the saved address and the typed key, so it is removed even if close fails.
test.afterEach(async () => {
  try {
    await app?.close()
  } finally {
    fs.rmSync(box.root, { recursive: true, force: true })
  }
})

// 1.59 L-13: the case's own workflow must be "Complete" before anything is run.
async function comfyCampaign(workflow: string): Promise<void> {
  await real.saveAndCheck(page, workflow)
  await real.openTestCampaign(app, page)
  await guardedStep('Choose ComfyUI', () => screens.chooseProvider(page, 'ComfyUI'))
}

test('Settings: the server address is saved, checked and removed', async () => {
  await real.saveAndCheck(page)
  await real.removeAddress(page)
})

test('Gemini: the paid confirm is cancelled and nothing is sent', async () => {
  await real.openTestCampaign(app, page)
  await guardedStep('Open the paid confirm and press Cancel', async () => {
    await screens.chooseProvider(page, 'Google Gemini')
    await screens.generate(page)
    const panel = screens.picturePanel(page)
    await expect(panel.getByText(/^This sends 1 paid request\(s\)/)).toBeVisible()
    await panel.getByRole('button', { name: 'Cancel' }).click()
    await expect(panel.getByRole('button', { name: 'Generate' })).toBeVisible()
    await expect(screens.runRows(page)).toHaveCount(0)
  })
})

test('ComfyUI MOSS: a picture from a prompt [ADMAN_E2E_MOSS=1]', async () => {
  test.skip(!switches.moss, 'Runs only with ADMAN_E2E_MOSS=1: it makes a run on the server.')
  test.setTimeout(RUN_CASE_MS)
  await comfyCampaign(screens.MOSS_LABEL)
  await guardedStep('Choose a slot and type the test prompt', async () => {
    await screens.chooseSlot(page)
    await screens.setPrompt(page, screens.E2E_PROMPT)
  })
  await guardedStep('Generate', () => screens.generate(page))
  await real.newestRunDone(page, RUN_WAIT_MS)
})

test('ComfyUI Flux: a picture from one product reference [ADMAN_E2E_FLUX=1]', async () => {
  test.skip(!switches.flux, 'Runs only with ADMAN_E2E_FLUX=1: it makes a run on the server.')
  test.setTimeout(RUN_CASE_MS)
  await comfyCampaign(screens.FLUX_LABEL)
  await real.addAndTickReference(app, box, page)
  await guardedStep('Generate', () => screens.generate(page))
  await real.newestRunDone(page, RUN_WAIT_MS)
})

test('ComfyUI cancel: the test cancels its own MOSS run from the run row [ADMAN_E2E_CANCEL=1]', async () => {
  test.skip(!switches.cancel, 'Runs only with ADMAN_E2E_CANCEL=1: it starts a run on the server.')
  test.setTimeout(RUN_CASE_MS)
  await comfyCampaign(screens.MOSS_LABEL)
  await guardedStep('Generate, then Cancel the run once it is on the server', async () => {
    await screens.generate(page)
    const row = screens.runRow(page)
    await expect(row).toContainText(/Working.*(waiting|working)/, { timeout: 5 * 60_000 })
    await row.getByRole('button', { name: 'Cancel' }).click()
    await expect(row).toContainText('Cancelled', { timeout: 5 * 60_000 })
  })
})

// SPEC 14 1.57 TP-6: one 2-second clip from a fixed prompt, which is left on the server.
test('ComfyUI video: a 2-second clip from a prompt [ADMAN_E2E_VIDEO=1]', async () => {
  test.skip(!videoOn, 'Runs only with ADMAN_E2E_VIDEO=1: it makes a video run on the server.')
  test.setTimeout(VIDEO_CASE_MS)
  await comfyCampaign(screens.H3_TEXT_LABEL)
  await guardedStep('Start a 2-second video from the test prompt', () =>
    screens.startVideo(page, 2),
  )
  await real.newestClipDone(page, VIDEO_WAIT_MS)
})

// A paid call: the orchestrator sets the switch only after the stakeholder's yes (1.54 P-2).
test('Gemini: a paid picture from a product reference [ADMAN_E2E_GEMINI=1]', async () => {
  test.skip(!switches.gemini, 'Runs only with ADMAN_E2E_GEMINI=1 and his yes: a paid call.')
  test.setTimeout(10 * 60_000)
  await real.openTestCampaign(app, page)
  await guardedStep('Choose Google Gemini', () => screens.chooseProvider(page, 'Google Gemini'))
  await real.addAndTickReference(app, box, page)
  await guardedStep('Generate', () => screens.generate(page))
  await real.confirmWithKey(page)
  await real.newestRunDone(page, 5 * 60_000)
})
