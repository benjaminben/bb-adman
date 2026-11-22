// ST-5: Settings in the app style. One saved made-up key (a list row with its badge), a refused
// ComfyUI address (a danger notice), and agent access turned on (the switch, the connect line)
// on a free port.
import { test, expect } from '@playwright/test'
import net from 'node:net'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

// A port nothing on this machine listens on now. The default (47821) may be held by another
// copy of the app, and then agent access is refused with "Port 47821 is in use".
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo
      server.close(() => resolve(port))
    })
  })
}

test('Settings, every section as a card', async () => {
  session = await openApp()
  const { page } = session
  const comfy = await screens.openSettings(page)

  const keys = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Keys' }) })
  const row = keys.getByRole('group').first()
  await row.getByRole('button', { name: 'Add' }).click()
  await row.getByRole('textbox').or(row.locator('input[type="password"]')).fill('made-up-key-AB12')
  await row.getByRole('button', { name: 'Save' }).click()
  await expect(row.getByText('Saved, ends in AB12')).toBeVisible()

  await comfy.getByLabel('Server address').fill('not an address')
  await comfy.getByRole('button', { name: 'Save' }).click()
  await expect(comfy.locator('#comfy-address-refusal')).toBeVisible()

  const agent = page.getByRole('region', { name: 'Agent access' })
  const toggle = agent.getByRole('switch', { name: 'Turn on agent access' })
  const port = String(await freePort())
  await agent.getByLabel('Port', { exact: true }).fill(port)
  await agent.getByRole('button', { name: 'Save port' }).click()
  await expect(agent.getByRole('button', { name: 'Save port' })).toBeEnabled()
  // The switch is held to the saved state: it flips only once mcp.setEnabled replies, so
  // check() and uncheck(), which test the state right after the click, can lose that race.
  await toggle.click()
  await expect(toggle).toBeChecked({ timeout: 10_000 })
  await expect(agent.getByRole('button', { name: 'Make a new token' })).toBeEnabled()
  await expect(agent.getByText(`http://127.0.0.1:${port}/mcp`, { exact: true })).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '187-settings')
  // Turned off again so the app closes without a running server.
  await expect(toggle).toBeEnabled()
  await toggle.click()
  await expect(toggle).not.toBeChecked({ timeout: 10_000 })
})
