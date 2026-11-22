// S2-7: the trial mark in the panels. With dev tools on and the stand-in's address saved,
// ComfyUI's offered picture and video workflows are trials, so the picture panel reads
// "ComfyUI (trial)" when ComfyUI is chosen, and so does the video's run dialog, opened from the
// editor's Generate panel on the master's background layer (R2E-9). The post is made a video
// in the editor first; the dialog is cancelled, so nothing is sent.
import { test, expect } from '@playwright/test'
import { startComfyStandIn, type StandIn } from '../helpers/comfy-stand-in'
import * as screens from '../e2e/screens'
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

test("The picture panel and the video's run dialog with ComfyUI (trial)", async () => {
  session = await openApp({ ADMAN_DEV_TOOLS: '1' })
  stand = await startComfyStandIn()
  const { app, page } = session
  const comfy = await screens.openSettings(page)
  await screens.saveAddress(comfy, stand.origin)
  await screens.createProject(page, 'Summer Launch')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  await screens.chooseProvider(page, 'ComfyUI')
  await screens.setPrompt(page, screens.E2E_PROMPT)
  await expect(screens.picturePanel(page).getByText('(trial)')).toBeVisible()
  await screens.picturePanel(page).scrollIntoViewIfNeeded()
  await shot(page, '01-panels-comfyui-trial')

  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().dblclick()
  await format(page).getByRole('radio', { name: 'Video' }).click()
  await expect(format(page).getByRole('radio', { name: 'Video' })).toBeChecked()
  const video = await screens.videoPanel(page)
  await video.getByRole('textbox', { name: 'Prompt' }).fill(screens.E2E_VIDEO_PROMPT)
  await video.getByRole('button', { name: 'Generate…' }).click()
  const dialog = screens.videoDialog(page)
  await dialog.getByRole('radio', { name: 'ComfyUI', exact: true }).check()
  await expect(dialog.getByText('(trial)')).toBeVisible()
  await shot(page, '02-video-dialog-comfyui-trial')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
})
