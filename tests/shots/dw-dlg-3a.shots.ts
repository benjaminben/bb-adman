// DLG-3a: the key dialog (472) and the address dialog (473) on the `form` frame. The key
// dialog opens when a Gemini run needs a key: the Gemini stand-in is installed first so no
// request could leave the computer, only a made-up value is typed (it must show as dots), and
// Cancel sends nothing. The address dialog opens when a ComfyUI run has no address; the
// stand-in ComfyUI on 127.0.0.1 answers, a refused made-up address shows the alert, and Cancel
// sends nothing.
import { test, expect, type Page } from '@playwright/test'
import { startComfyStandIn, type StandIn } from '../helpers/comfy-stand-in'
import * as screens from '../e2e/screens'
import { serveNeedsFromApp } from '../e2e/stand-in-runs'
import { standInForGemini } from '../e2e/gemini-stand-in'
import { closeApp, openApp, shot, type Session } from './shot'

const FAKE_KEY = 'fake-key-not-real'

let session: Session | undefined
let stand: StandIn | undefined

test.afterEach(async () => {
  try {
    await closeApp(session)
    await stand?.close()
  } finally {
    session = undefined
    stand = undefined
  }
})

async function still(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
}

// A campaign made from the test brief, its first slot chosen with a one-picture prompt.
async function campaignWithPrompt(session: Session): Promise<void> {
  const { app, page } = session
  await screens.createProject(page, 'Summer Launch')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  await screens.chooseSlot(page)
  await screens.untickReferences(page)
  await screens.setPrompt(page, screens.E2E_PROMPT)
  await screens.setCount(page, 1)
}

test('472 the key dialog with a made-up key typed', async () => {
  session = await openApp()
  const { app, page } = session
  await standInForGemini(app)
  await still(page)
  await campaignWithPrompt(session)
  await screens.chooseProvider(page, 'Google Gemini')
  const run = await screens.openRunDialog(page)
  await run.getByRole('button', { name: 'Generate', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Google Gemini key' })
  const field = dialog.getByLabel('API key')
  await expect(field).toBeFocused()
  await field.fill(FAKE_KEY)
  await expect(field).toHaveAttribute('type', 'password')
  await page.waitForTimeout(300)
  await shot(page, '472-key-dialog')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
})

test('473 the address dialog with a refused address', async () => {
  session = await openApp({ ADMAN_DEV_TOOLS: '1' })
  stand = await startComfyStandIn()
  const { page } = session
  await still(page)
  await serveNeedsFromApp(page, stand)
  await campaignWithPrompt(session)
  await screens.chooseProvider(page, 'ComfyUI')
  await screens.generate(page)
  const dialog = page.getByRole('dialog', { name: 'ComfyUI address' })
  const field = dialog.getByLabel('Server address')
  await expect(field).toBeFocused()
  await field.fill('ftp://studio-gpu.local:21')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '473-address-dialog')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
})
