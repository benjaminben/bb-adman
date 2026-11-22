// SH-1 (spec/phases/design-wave-screens-a.md, "SH-1 — Top bar"): 436 the top bar with two
// campaigns, one running, Activity counting 1; 437 the error banner with its "x" Dismiss. The
// run is a Gemini run held by gemini-answers.ts (made-up key, `fetch` replaced in the main
// process: nothing leaves the computer and no call is paid), as workflow 5.8's steps do. The
// banner comes from a refused server address, as comfy-stand-in.spec.ts does.
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import { answerQuit } from '../e2e/quit-answer'
import { CAMPAIGN } from '../e2e/workflow-5-1-steps'
import { activityButton, campaignTab, runLeftGoing } from '../e2e/workflow-5-8-steps'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  if (session) await answerQuit(session.app)
  await closeApp(session)
  session = undefined
})

async function stillPage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
}

test('The top bar with two campaigns, one running', async () => {
  test.setTimeout(120_000)
  session = await openApp()
  const { app, page } = session
  await stillPage(page)
  await runLeftGoing(app, page)
  await expect(activityButton(page)).toContainText('1 running')
  await expect(campaignTab(page, CAMPAIGN)).toContainText('Running')
  await page.waitForTimeout(300)
  await shot(page, '436-top-bar-running')
})

test('The error banner under the top bar', async () => {
  session = await openApp()
  const { page } = session
  await stillPage(page)
  await screens.createProject(page, 'Alpine Spring')
  const comfy = await screens.openSettings(page)
  await comfy.getByLabel('Server address').fill('ftp://127.0.0.1:21')
  await comfy.getByRole('button', { name: 'Save' }).click()
  const banner = page
    .getByRole('alert')
    .filter({ has: page.getByRole('button', { name: 'Dismiss' }) })
  await expect(banner).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '437-error-banner')
})
