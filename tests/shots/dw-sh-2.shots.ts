// SH-2 (spec/phases/design-wave-screens-a.md, "SH-2 — Settings has a way out"): 438 Settings
// opened from a project with a campaign tab shown: the campaign tabs stay drawn and "Close
// settings" sits at the top right. Escape then returns to the same campaign tab. The campaign
// comes from the test brief, made up; nothing is generated.
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
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

test('Settings over a project, the tabs drawn and the way out', async () => {
  test.setTimeout(120_000)
  session = await openApp()
  const { app, page } = session
  await stillPage(page)
  await screens.createProject(page, 'Alpine Spring')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  const tab = page.getByRole('tab', { name: screens.E2E_CAMPAIGN })
  await expect(tab).toHaveAttribute('aria-selected', 'true')
  await screens.openSettingsPage(page, 'AI services')
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()
  await expect(page.getByRole('tablist', { name: 'Open campaigns' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Close settings' })).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '438-settings-over-project')

  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toHaveCount(0)
  await expect(tab).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('heading', { name: screens.E2E_CAMPAIGN, level: 2 })).toBeVisible()
})
