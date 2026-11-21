// Steps of test:e2e:real (SPEC 14 1.56 E2E-R) that hold the address, a photo path or the key.
// Each runs inside guardedStep, so a failure prints the step's name only. Not a test file.
import fs from 'node:fs'
import path from 'node:path'
import { expect, type ElectronApplication, type Page } from '@playwright/test'
import type { Sandbox } from '../e2e/launch'
import * as screens from '../e2e/screens'
import { makeTestPicture } from '../comfy/test-picture'
import { guardedStep } from './guard'
import { checkPicture } from './pictures'
import { picturePaths } from './switches'

export const NO_ADDRESS = 'COMFY_BASE_URL is not set, in the terminal or in .env.local.'
export const NO_GEMINI_KEY = 'ADMAN_E2E_GEMINI=1 needs GEMINI_API_KEY set in the terminal.'

function serverAddress(): string {
  const address = process.env.COMFY_BASE_URL
  if (!address) throw new Error(NO_ADDRESS)
  return address
}

// The given product photos, checked by the P-1 rules, or the test-made picture written into
// the sandbox. Only these paths reach the dialog stub; none is printed.
export function referencePictures(box: Sandbox): string[] {
  const given = picturePaths(process.env.ADMAN_E2E_PICTURES)
  given.forEach((file, i) => checkPicture(file, i + 1))
  if (given.length > 0) return given
  const made = path.join(box.root, 'test-made-picture.png')
  fs.writeFileSync(made, makeTestPicture())
  return [made]
}

// Settings: type the address, save it, Check; the version line and a result on every
// workflow row (1.59 L-13). A run case also names its own workflow, which must be "Complete",
// so a missing model fails that case before any run is made.
export async function saveAndCheck(page: Page, needed?: string): Promise<void> {
  // Outside the guard, so its fixed line is shown; it names no value.
  const address = serverAddress()
  await guardedStep('Save the server address and check the server', async () => {
    const comfy = await screens.openSettings(page)
    await screens.saveAddress(comfy, address)
    await screens.checkServer(comfy, 120_000)
    const rows = screens.workflowRows(comfy)
    await expect(rows.first()).toBeVisible()
    for (const row of await rows.all()) await expect(row).toContainText(screens.CHECK_RESULT)
  })
  if (needed === undefined) return
  await guardedStep('See that the workflow this case runs is complete', async () => {
    const comfy = page.getByRole('region', { name: 'ComfyUI server' })
    await expect(screens.workflowRow(comfy, needed)).toContainText('Complete')
  })
}

export async function removeAddress(page: Page): Promise<void> {
  await guardedStep('Remove the server address', async () => {
    const comfy = await screens.openSettings(page)
    await comfy.getByRole('button', { name: 'Remove' }).click()
    await expect(comfy.getByText('No address saved.')).toBeVisible()
  })
}

export async function openTestCampaign(app: ElectronApplication, page: Page): Promise<void> {
  await guardedStep('Create the project and the campaign from the test brief', async () => {
    await screens.createProject(page, 'E2E real')
    await screens.loadBriefAndCreate(app, page)
    await screens.openCampaign(page)
    await screens.setCount(page, 1)
  })
}

// "Add pictures" through the dialog stub, then tick the first one.
export async function addAndTickReference(app: ElectronApplication, box: Sandbox, page: Page) {
  // Outside the guard, so a P-1 refusal shows its own fixed line; it names no path.
  const files = referencePictures(box)
  await guardedStep('Add the reference pictures and tick the first', async () => {
    await screens.answerOpenDialog(app, files)
    const references = page.getByRole('region', { name: 'Reference pictures' })
    await references.getByRole('button', { name: 'Add pictures' }).click()
    const ticks = references.getByRole('checkbox')
    await expect(ticks).toHaveCount(files.length)
    await ticks.first().check()
  })
}

// Waits for the newest run to be done and its picture to load.
export async function newestRunDone(page: Page, timeout: number): Promise<void> {
  await guardedStep('Wait for the run to be done with its picture', async () => {
    const row = screens.runRow(page)
    await expect(row).toContainText(/Done|Failed|Cancelled/, { timeout })
    await expect(row).toContainText('Done')
    const picture = row.getByRole('img', { name: 'Result 1' })
    await expect(picture).toBeVisible()
    await expect
      .poll(() => picture.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0)
  })
}

// SPEC 14 1.57 TP-6: waits for the newest run, a video, to be done and its clip to load.
export async function newestClipDone(page: Page, timeout: number): Promise<void> {
  await guardedStep('Wait for the video to be done with its clip loaded', async () => {
    const row = screens.runRow(page)
    await expect(row).toContainText(/Done|Failed|Cancelled/, { timeout })
    await expect(row).toContainText('Done')
    await screens.clipHasMetadata(page, 60_000)
  })
}

// The paid confirm's Confirm, then the key typed into the key dialog.
export async function confirmWithKey(page: Page): Promise<void> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error(NO_GEMINI_KEY)
  await guardedStep('Confirm the paid run and give the key', async () => {
    const panel = screens.picturePanel(page)
    // Review S-1: only a run of one paid request is ever confirmed.
    await expect(panel.getByText(/^This sends 1 paid request\(s\)/)).toBeVisible()
    await panel.getByRole('button', { name: 'Confirm' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('API key').fill(key)
    await dialog.getByRole('button', { name: 'Save and continue' }).click()
    await expect(dialog).toBeHidden()
  })
}
