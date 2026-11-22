// S2-6: the address dialog (empty, then with a refused address) and the licence dialog for an
// H3 video run, in the built app against the stand-in ComfyUI on 127.0.0.1.
import { test, expect, type Page } from '@playwright/test'
import { startComfyStandIn, type StandIn } from '../helpers/comfy-stand-in'
import * as screens from '../e2e/screens'
import { serveNeedsFromApp } from '../e2e/stand-in-runs'
import { format } from '../e2e/video-variant-steps'
import { closeApp, openApp, shot, type Session } from './shot'

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

// The built app on a campaign made from the test brief, with the stand-in answering and,
// when asked, its address saved first.
async function campaign(withAddress: boolean): Promise<Page> {
  session = await openApp({ ADMAN_DEV_TOOLS: '1' })
  stand = await startComfyStandIn()
  const { app, page } = session
  await serveNeedsFromApp(page, stand)
  if (withAddress) await screens.saveAddress(await screens.openSettings(page), stand.origin)
  await screens.createProject(page, 'Summer Launch')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  return page
}

test('The address dialog, empty and with a refused address', async () => {
  const page = await campaign(false)
  await screens.chooseProvider(page, 'ComfyUI')
  await screens.chooseSlot(page)
  await screens.setPrompt(page, screens.E2E_PROMPT)
  await screens.setCount(page, 1)
  await screens.generate(page)
  const dialog = page.getByRole('dialog', { name: "Enter your ComfyUI server's address" })
  await expect(dialog.getByLabel('Server address')).toBeFocused()
  await shot(page, '01-address-dialog-empty')

  await dialog.getByLabel('Server address').fill('ftp://studio-gpu.local:21')
  await dialog.getByRole('button', { name: 'Save and continue' }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await shot(page, '02-address-dialog-refused')
})

test('The licence dialog for an H3 video run', async () => {
  const page = await campaign(true)
  // A video start needs a video post (P7-11): the master is changed to video in the editor,
  // as in video-variant-steps.ts, and the overview is shown again.
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().click()
  await format(page).getByRole('radio', { name: 'Video' }).click()
  await expect(format(page).getByRole('radio', { name: 'Video' })).toBeChecked()
  await page.getByRole('tab', { name: 'Overview' }).click()
  await screens.startVideo(page, 4)
  await expect(screens.licenceDialog(page).getByRole('checkbox')).toBeFocused()
  await shot(page, '03-licence-dialog-h3-video')
})
