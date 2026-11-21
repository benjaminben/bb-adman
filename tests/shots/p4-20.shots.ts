// P4-20: workflow 5.1 end to end. The campaign comes from the made-up Markdown brief of P4-15,
// read with the fake provider. 103: the master once done (a fake picture for the background,
// text placed by the fake layout, a suggested call to action, a cut-out on a new picture layer).
// 104: workflow 5.8, the other campaign shown while the first one's run has finished. 105 and
// 106: a failed run of five Gemini error kinds and one stand-in ComfyUI run, in earlier options
// and in the activity panel. Gemini is answered by tests/e2e/gemini-answers.ts with a made-up
// key; ComfyUI by the stand-in on 127.0.0.1. No paid call and no real server.
import { test, expect } from '@playwright/test'
import { startComfyStandIn, type StandIn } from '../helpers/comfy-stand-in'
import * as screens from '../e2e/screens'
import { MADE_UP_KEY } from '../e2e/gemini-stand-in'
import { installGemini, releaseHeld } from '../e2e/gemini-answers'
import { answerQuit } from '../e2e/quit-answer'
import { command } from '../e2e/render-helpers'
import { serveNeedsFromApp } from '../e2e/stand-in-runs'
import * as w from '../e2e/workflow-5-1-steps'
import * as f from '../e2e/workflow-5-1-failures'
import { activityButton, campaignTab, runLeftGoing } from '../e2e/workflow-5-8-steps'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined
let stand: StandIn | undefined

test.afterEach(async () => {
  try {
    if (session) await answerQuit(session.app)
    await closeApp(session)
    await stand?.close()
  } finally {
    session = undefined
    stand = undefined
  }
})

test('The master once workflow 5.1 is done', async () => {
  test.setTimeout(120_000)
  session = await openApp()
  const { app, page } = session
  await screens.createProject(page, 'Harbour')
  await w.readBriefAndCreate(app, page)
  const place = await w.placeOf(page, w.CAMPAIGN)
  const layers = await w.layersOf(page, place)
  await w.openMaster(page)
  await w.selectLayer(page, layers.find((l) => l.type === 'background')!.name)
  await w.makePictures(page, 2)
  await w.useOption(page, 2)
  await w.placeText(page)
  const action = layers.find((l) => l.slot === 'call-to-action')!
  await w.suggestAndUse(page, action.name, 'Find your fit')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Add picture layer' }).click()
  await w.makePictures(page, 1)
  await w.useOption(page, 1)
  await w.cutOut(page)
  await w.useOption(page, 1)
  await page.waitForTimeout(800)
  await shot(page, '130-workflow-5-1-master')
})

test('A run finished in another campaign', async () => {
  test.setTimeout(120_000)
  session = await openApp()
  const { app, page } = session
  await runLeftGoing(app, page)
  await releaseHeld(app, 'picture')
  await expect(campaignTab(page, w.CAMPAIGN).getByRole('img', { name: 'New result' })).toBeVisible({
    timeout: 15_000,
  })
  await activityButton(page).click()
  await expect(page.getByRole('region', { name: 'Activity' }).getByText('New')).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '131-workflow-5-8-new-result')
})

test('Failed runs of each kind', async () => {
  test.setTimeout(120_000)
  session = await openApp({ ADMAN_DEV_TOOLS: '1' })
  stand = await startComfyStandIn()
  const { app, page } = session
  await serveNeedsFromApp(page, stand)
  await screens.saveAddress(await screens.openSettings(page), stand.origin)
  await installGemini(app)
  await command(page, 'secret.set', { name: 'gemini.apiKey', value: MADE_UP_KEY })
  await screens.createProject(page, 'Harbour')
  await w.readBriefAndCreate(app, page)
  const place = await w.placeOf(page, w.CAMPAIGN)
  const background = (await w.layersOf(page, place)).find((l) => l.type === 'background')!
  await f.failEachGeminiKind(app, page, place, background.id)
  await f.failOnComfy(page, stand, place, background.id)

  await w.openMaster(page)
  await w.selectLayer(page, background.name)
  await f.expectFailure(w.earlierOptions(page), f.COMFY_SENTENCE)
  await page.waitForTimeout(500)
  await shot(page, '132-earlier-options-each-failure')

  await activityButton(page).click()
  await f.expectFailure(page.getByRole('region', { name: 'Activity' }), f.COMFY_SENTENCE)
  await page.waitForTimeout(300)
  await shot(page, '133-activity-each-failure')
})
