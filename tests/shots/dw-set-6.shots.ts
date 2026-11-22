// SET-6 (spec/phases/design-wave-screens-a.md, "SET-6 — One save rule for single values"): 419
// the Agents page's Port field just after Enter saved a new port, with "Saved" beside it. Agent
// access stays off. Reduce motion and a fixed Math.random keep the window still. Nothing leaves
// this machine.
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import { answerQuit } from '../e2e/quit-answer'
import { freePort } from '../integration/mcp/http-client'
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

test('Settings, the Port field just after a save', async () => {
  session = await openApp()
  const { page } = session
  await holdStill(page)
  await screens.openSettingsPage(page, 'Agents')
  const access = page.getByRole('region', { name: 'Agent access' })
  const port = access.getByLabel('Port', { exact: true })
  await port.fill(String(await freePort()))
  await port.press('Enter')
  await expect(access.getByText('Saved', { exact: true })).toBeVisible()
  await shot(page, '419-settings-port-saved')
})
