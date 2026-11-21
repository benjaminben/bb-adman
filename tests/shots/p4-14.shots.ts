// P4-14: the activity panel. The campaign comes from the e2e brief. Gemini is answered by the
// stand-in in p4-14-gemini.ts (a made-up key, no request leaves the computer), so a paid row
// can fail, run and finish; the fake provider gives a free finished row. Pictures: the failed
// row with its sentence and Retry (82), the run dialog in retry mode it opens (75, owed by
// P4-12), the Activity button with "1 running" and the new-result dot (80), and the panel with
// running and finished rows (81).
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import { MADE_UP_KEY } from '../e2e/gemini-stand-in'
import { holdGemini, installGemini, releaseGemini } from './p4-14-gemini'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  if (session) await releaseGemini(session.app, 10, 'refuse')
  await closeApp(session)
  session = undefined
})

const activityButton = (page: Page) => page.getByRole('button', { name: /^Activity/ })
const activityPanel = (page: Page) => page.getByRole('region', { name: 'Activity' })

async function generateWith(page: Page, provider: string): Promise<void> {
  await screens.chooseProvider(page, provider)
  await screens.generate(page)
}

async function confirmPaid(page: Page): Promise<void> {
  await screens.picturePanel(page).getByRole('button', { name: 'Confirm' }).click()
}

test('The activity panel: a failed paid row, its retry dialog, then running and new results', async () => {
  session = await openApp()
  const { app, page } = session
  await installGemini(app)
  await screens.createProject(page, 'Summer Launch')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  await screens.chooseSlot(page)
  await screens.setPrompt(page, screens.E2E_PROMPT)
  await screens.setCount(page, 1)

  // A Gemini run the stand-in refuses: the key dialog first, then the failed row.
  await generateWith(page, 'Google Gemini')
  await confirmPaid(page)
  const keyDialog = page.getByRole('dialog', { name: 'Add your Google Gemini key' })
  await keyDialog.getByLabel('API key').fill(MADE_UP_KEY)
  await keyDialog.getByRole('button', { name: 'Save and continue' }).click()
  await expect(screens.runRow(page)).toContainText('Failed', { timeout: 15_000 })
  await generateWith(page, 'Fake provider')
  await expect(screens.runRow(page)).toContainText('Done', { timeout: 15_000 })

  await activityButton(page).click()
  const panel = activityPanel(page)
  const failed = panel.getByRole('listitem').filter({ hasText: 'Failed' })
  await expect(failed.getByRole('button', { name: 'Retry' })).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '82-activity-failed-row')

  await failed.getByRole('button', { name: 'Retry' }).click()
  const retry = page.getByRole('dialog', { name: 'Try again' })
  await expect(retry.getByText('Provider: Google Gemini')).toBeVisible()
  await expect(retry.getByText(/^Paid generations for this campaign so far:/)).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '75-run-dialog-retry')
  await retry.getByRole('button', { name: 'Cancel' }).click()
  await panel.getByRole('button', { name: 'Close activity' }).click()

  // Two held Gemini runs; one finishes while the campaign page is not shown, so it is new.
  await holdGemini(app)
  for (let i = 0; i < 2; i += 1) {
    await generateWith(page, 'Google Gemini')
    await confirmPaid(page)
  }
  await expect(activityButton(page)).toContainText('2 running', { timeout: 15_000 })
  await page.getByRole('tab', { name: 'Project' }).click()
  await expect.poll(() => releaseGemini(app, 0, 'picture')).toBe(2)
  await releaseGemini(app, 1, 'picture')
  await expect(activityButton(page)).toContainText('1 running', { timeout: 15_000 })
  await expect(activityButton(page).getByRole('img', { name: 'New results' })).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '80-activity-button-marks')

  await activityButton(page).click()
  await expect(activityPanel(page).getByText('New')).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '81-activity-panel-rows')
})
