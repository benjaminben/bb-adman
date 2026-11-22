// SET-5 (spec/phases/design-wave-screens-a.md, "SET-5 — Agents page"): 417 the Agents page with
// agent access on and Connect folded; 418 Connect open with the token masked. Agent access is
// turned on on a free port (another copy of the app may hold 47821) and off again at the end.
// The token is never shown: "Show" is not pressed. Reduce motion and a fixed Math.random keep the
// window still. Nothing leaves this machine.
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

test('Settings, the Agents page with agent access on', async () => {
  session = await openApp()
  const { page } = session
  await holdStill(page)
  await screens.openSettingsPage(page, 'Agents')
  const access = page.getByRole('region', { name: 'Agent access' })
  const toggle = access.getByRole('switch', { name: 'Turn on agent access' })
  await access.getByLabel('Port', { exact: true }).fill(String(await freePort()))
  await access.getByLabel('Port', { exact: true }).press('Enter')
  await expect(access.getByText('Saved', { exact: true })).toBeVisible()
  await toggle.click()
  await expect(toggle).toBeChecked({ timeout: 10_000 })
  const connect = access.getByRole('region', { name: 'Connect to Claude' })
  await expect(connect).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '417-settings-agents-on')

  await connect.getByRole('button', { name: 'Connect to Claude' }).click()
  await expect(connect.getByRole('button', { name: 'Show' })).toBeVisible()
  await page.mouse.move(0, 0)
  await page.waitForTimeout(300)
  await shot(page, '418-settings-agents-connect-masked')

  // Turned off again so the app closes without a running server.
  await expect(toggle).toBeEnabled()
  await toggle.click()
  await expect(toggle).not.toBeChecked({ timeout: 10_000 })
})
