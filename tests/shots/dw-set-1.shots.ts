// SET-1 (spec/phases/design-wave-screens-a.md): Settings as a side list of four pages. 410 the
// AI services page, 411 the Agents page. Agent access stays off, so no token is drawn. Reduce
// motion and a fixed Math.random keep the window still. Nothing leaves this machine.
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import { answerQuit } from '../e2e/quit-answer'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  if (session) await answerQuit(session.app)
  await closeApp(session)
  session = undefined
})

async function holdStill(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
}

test('Settings, the AI services and Agents pages', async () => {
  session = await openApp()
  const { page } = session
  await holdStill(page)
  await expect(await screens.openSettings(page)).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '410-settings-ai-services')

  await screens.chooseSettingsPage(page, 'Agents')
  await expect(page.getByRole('region', { name: 'Agent runs' })).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '411-settings-agents')
})
