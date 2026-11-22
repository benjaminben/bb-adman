// P10-9: the Connect panel with both blocks, Claude Code and Claude Desktop (295), and the
// Agent access section with the setting off, which shows neither (296).
import { test, expect } from '@playwright/test'
import * as screens from '../e2e/screens'
import { command } from '../e2e/render-helpers'
import { freePort } from '../integration/mcp/http-client'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

test('Agent access: both connect blocks, then the setting off', async () => {
  session = await openApp()
  const { page } = session
  await command(page, 'settings.update', { mcp: { port: await freePort() } })
  await screens.openSettings(page)
  const agent = page.getByRole('region', { name: 'Agent access' })
  const toggle = agent.getByRole('switch', { name: 'Turn on agent access' })

  await toggle.check()
  await expect(toggle).toBeChecked()
  await expect(agent.getByRole('button', { name: 'Make a new token' })).toBeEnabled()
  const desktop = agent.getByRole('region', { name: 'Claude Desktop' })
  await expect(desktop.locator('pre code')).toContainText('--mcp-bridge')
  await desktop.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await shot(page, '295-settings-connect-both-blocks')

  await expect(toggle).toBeEnabled()
  await toggle.uncheck()
  await expect(toggle).not.toBeChecked()
  await expect(agent.getByRole('region', { name: 'Connect to Claude' })).toHaveCount(0)
  await page.waitForTimeout(300)
  await shot(page, '296-settings-agent-access-off')
})
