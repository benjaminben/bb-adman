// The screens that exist before the Phase 2 screen slices: Start, Settings, the project
// home, the brief summary and the campaign with one finished fake run.
import { test, expect } from '@playwright/test'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

test('Start, Settings, project home, brief and campaign', async () => {
  session = await openApp()
  const { app, page } = session
  await expect(page.getByRole('tab', { name: 'Start' })).toBeVisible()
  await shot(page, '01-start')

  await screens.openSettings(page)
  await shot(page, '02-settings')

  await screens.createProject(page, 'Summer Launch')
  await shot(page, '03-project-home-empty')

  await screens.answerOpenDialog(app, [screens.E2E_BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  const brief = page.getByRole('region', { name: 'Brief' })
  await expect(brief.getByRole('list', { name: 'Subjects' })).toBeVisible()
  await shot(page, '04-brief-form')

  await brief.getByRole('button', { name: 'Create campaign' }).click()
  await expect(page.getByRole('heading', { name: screens.E2E_CAMPAIGN, level: 2 })).toBeVisible()
  await shot(page, '05-campaign-new')

  await screens.chooseProvider(page, 'Fake provider')
  await screens.setPrompt(page, screens.E2E_PROMPT)
  await screens.generate(page)
  await expect(screens.runRow(page).getByRole('img').first()).toBeVisible({ timeout: 30_000 })
  await shot(page, '06-campaign-after-run')

  await page.getByRole('button', { name: 'Back to project' }).click()
  await expect(page.getByRole('list', { name: 'Campaigns' })).toBeVisible()
  await shot(page, '07-project-home-with-campaign')
})
