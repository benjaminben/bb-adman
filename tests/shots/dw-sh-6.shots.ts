// SH-6 (spec/phases/design-wave-screens-a.md, "SH-6 — Result notice and agent line"): 443 the
// result notice with its "x" Dismiss and the agent line with the bot icon, together. The
// project home shows while the fake provider makes a picture for the campaign's master, so the
// notice says where it is; an MCP client on this machine then reads the project, so the line
// names the tool and the project. Read tools and the fake provider only: nothing is paid and
// nothing leaves the machine. Made-up names only.
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import { answerQuit } from '../e2e/quit-answer'
import { command, query } from '../e2e/render-helpers'
import { layersOf, placeOf } from '../e2e/workflow-5-1-steps'
import { freePort } from '../integration/mcp/http-client'
import { toolSession } from '../integration/mcp/tool-client'
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

// A fake picture for the master's background while the project home shows.
async function finishPicture(page: Page): Promise<void> {
  const place = await placeOf(page, screens.E2E_CAMPAIGN)
  const background = (await layersOf(page, place)).find((l) => l.type === 'background')!
  await command(page, 'generation.runImages', {
    ...{ projectId: place.projectId, variantId: place.variantId, layerId: background.id },
    prompt: 'A sunlit harbour at first light, wide and calm',
    referenceAssetIds: [],
    count: 1,
    provider: 'fake',
  })
  const notice = page.getByRole('status').filter({ hasText: 'New pictures are ready' })
  await expect(notice).toBeVisible({ timeout: 20_000 })
  await expect(notice.getByRole('button', { name: 'Dismiss' })).toHaveAttribute('title', 'Dismiss')
}

test('The result notice and the agent line together', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { app, page } = session
  await stillPage(page)
  const port = await freePort()
  await command(page, 'settings.update', { mcp: { port } })
  await command(page, 'mcp.setEnabled', { enabled: true })
  const { token } = (await query(page, 'mcp.getConnectInfo', {})) as { token: string }
  const agent = await toolSession(port, token)
  await screens.createProject(page, 'Harbour Lights')
  await screens.loadBriefAndCreate(app, page)
  await finishPicture(page)

  const { projectId } = await placeOf(page, screens.E2E_CAMPAIGN)
  expect((await agent.call('get_project', { project_id: projectId })).isError).toBeFalsy()
  const line = page.getByRole('status').filter({ hasText: 'Agent working:' })
  await expect(line).toHaveText('Agent working: get_project · Harbour Lights')
  await page.waitForTimeout(300)
  await shot(page, '443-result-notice-agent-line')
})
