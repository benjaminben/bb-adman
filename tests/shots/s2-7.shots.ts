// S2-7: the trial mark in the panels. With dev tools on and the stand-in's address saved,
// ComfyUI's offered picture and video workflows are trials, so both panels read
// "ComfyUI (trial)" when ComfyUI is chosen.
import { test, expect } from '@playwright/test'
import { startComfyStandIn, type StandIn } from '../helpers/comfy-stand-in'
import * as screens from '../e2e/screens'
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

test('The picture panel and the video card with ComfyUI (trial)', async () => {
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
  const video = screens.videoPanel(page)
  await video.getByLabel('Provider').selectOption({ label: 'ComfyUI' })
  await video.getByLabel('Prompt').fill(screens.E2E_VIDEO_PROMPT)
  await expect(screens.picturePanel(page).getByText('(trial)')).toBeVisible()
  await expect(video.getByText('(trial)')).toBeVisible()
  await screens.picturePanel(page).scrollIntoViewIfNeeded()
  await shot(page, '01-panels-comfyui-trial')
})
