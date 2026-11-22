// R3-2: wherever a service is named for a generative job, its model is named too. 520: the run
// dialog's provider choice, each provider with its model on a second, muted line, and the cost
// line naming the model. 521: Settings, AI services: the keys list with the models a key
// unlocks, and the provider defaults with each job's model. 522: a picture run done on the
// stand-in ComfyUI (127.0.0.1), "ComfyUI · MOSS-Image" named above the new pictures.
// Nothing is confirmed on a paid provider; no paid service or real server is reached. Made-up
// words and drawn grey pictures only.
import { test, expect, type Page } from '@playwright/test'
import { startComfyStandIn, type StandIn } from '../helpers/comfy-stand-in'
import * as screens from '../e2e/screens'
import { openSettingsPage } from '../e2e/settings-pages'
import { finishWithPicture, nthSentId, serveNeedsFromApp } from '../e2e/stand-in-runs'
import { closeApp, openApp, shot, type Session } from './shot'

// The output node of the moss workflow, as the stand-in spec finishes its runs.
const MOSS_OUTPUT = '9'

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

async function still(page: Page, name: string): Promise<void> {
  await page.mouse.move(640, 790)
  await page.waitForTimeout(400)
  await shot(page, name)
}

const closeActivity = async (page: Page) => {
  if (await screens.activityPanel(page).isVisible()) {
    await page.getByRole('button', { name: /^Activity/ }).click()
  }
  await expect(screens.activityPanel(page)).toBeHidden()
}

test('520 to 522 the model beside the provider', async () => {
  test.setTimeout(240_000)
  session = await openApp({ ADMAN_DEV_TOOLS: '1' })
  stand = await startComfyStandIn()
  const { app, page } = session
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await serveNeedsFromApp(page, stand)
  await screens.saveAddress(await screens.openSettings(page), stand.origin)

  // 521: AI services, the keys and the defaults.
  await openSettingsPage(page, 'AI services')
  const image = page.getByRole('group', { name: 'Image generation' })
  await expect(image.getByRole('button', { name: 'Google Gemini · Nano Banana 2.1' })).toBeVisible()
  await expect(image.getByRole('button', { name: 'ComfyUI · MOSS-Image' })).toBeVisible()
  await page.getByRole('region', { name: 'Defaults' }).scrollIntoViewIfNeeded()
  await still(page, '521-settings-provider-defaults')

  await screens.createProject(page, 'Harbour Lights')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  await screens.chooseSlot(page)
  await screens.untickReferences(page)
  await screens.setPrompt(page, 'A lantern on a quiet harbour wall at dusk')

  // 520: the run dialog with Google Gemini chosen; cancelled, so nothing is sent.
  await screens.chooseProvider(page, 'Google Gemini')
  await screens.setCount(page, 2)
  const run = await screens.openRunDialog(page)
  await expect(
    run.getByText(/^Paid: 2 pictures to Google Gemini · Nano Banana 2\.1$/),
  ).toBeVisible()
  await expect(run.getByRole('radio', { name: 'ComfyUI · MOSS-Image' })).toBeVisible()
  await still(page, '520-run-dialog-provider-models')
  await run.getByRole('button', { name: 'Cancel' }).click()
  await expect(run).toBeHidden()

  // 522: one picture on the stand-in ComfyUI, then Earlier options.
  await screens.chooseProvider(page, 'ComfyUI')
  await screens.setCount(page, 1)
  await screens.generate(page)
  finishWithPicture(stand, await nthSentId(stand, 1), MOSS_OUTPUT)
  const panel = screens.picturePanel(page)
  await expect(panel.getByRole('button', { name: /^Use option/ }).first()).toBeVisible({
    timeout: 20_000,
  })
  const fresh = panel.getByRole('region', { name: 'New pictures' })
  await expect(fresh.getByText('ComfyUI · MOSS-Image')).toBeVisible()
  await closeActivity(page)
  await still(page, '522-earlier-run-model')
})
