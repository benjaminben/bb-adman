// ED-4b (spec/phases/design-wave-screens-a.md): the Generate panel's run state and Earlier
// options. 431: a picture run of three on the stand-in ComfyUI (127.0.0.1) going, drawn as three
// spinner tiles. 432: that run done, its tiles filled, and "Earlier options" open with a run an
// agent started on the fake provider and a run the stand-in could not finish. No paid provider
// and no real server is reached; the agent is an MCP client in this process. Made-up words and
// drawn grey pictures only.
import { test, expect, type Page } from '@playwright/test'
import { startComfyStandIn, type StandIn } from '../helpers/comfy-stand-in'
import * as screens from '../e2e/screens'
import { firstIds } from '../e2e/held-run'
import { connectThroughSettings } from '../e2e/mcp-workflow-steps'
import { query } from '../e2e/render-helpers'
import {
  finishWithError,
  finishWithPicture,
  nthSentId,
  serveNeedsFromApp,
} from '../e2e/stand-in-runs'
import type { ToolSession } from '../integration/mcp/tool-client'
import { closeApp, openApp, shot, type Session } from './shot'

// The output node of the moss workflow, as the stand-in spec finishes its runs.
const MOSS_OUTPUT = '9'

let session: Session | undefined
let stand: StandIn | undefined

test.afterEach(async () => {
  try {
    await closeApp(session)
    await stand?.close()
  } finally {
    session = undefined
    stand = undefined
  }
})

async function still(page: Page, name: string): Promise<void> {
  await page.mouse.move(640, 790)
  await page.waitForTimeout(400)
  await shot(page, name)
}

// Agents may start runs with the fake provider; the agent connects before any project.
async function agentConnected(page: Page): Promise<ToolSession> {
  await screens.openSettingsPage(page, 'Agents')
  const tick = page
    .getByRole('region', { name: 'Agent runs' })
    .getByRole('switch', { name: 'Let agents start runs with Fake provider' })
  await tick.click()
  await expect(tick).toBeChecked()
  return connectThroughSettings(page)
}

// The agent's run of two pictures on the background layer, waited for until done.
async function agentRun(page: Page, agent: ToolSession, layerName: string): Promise<void> {
  const { projectId, variantId } = await firstIds(page)
  const got = (await query(page, 'variant.get', { projectId, variantId })) as {
    layers: { id: string; name: string }[]
  }
  const layer = got.layers.find((l) => l.name === layerName)!
  const reply = await agent.call('generate_images', {
    project_id: projectId,
    variant_id: variantId,
    layer_id: layer.id,
    prompt: 'Lanterns along a quiet harbour wall at dusk',
    reference_asset_ids: [],
    count: 2,
    provider: 'fake',
  })
  expect(reply.isError ?? false).toBe(false)
  const done = async () => {
    const rows = (await query(page, 'job.earlierOptions', {
      projectId,
      layerId: layer.id,
    })) as unknown as {
      job: { status: string }
    }[]
    return rows.filter((r) => r.job.status === 'succeeded').length
  }
  await expect.poll(done, { timeout: 20_000 }).toBe(1)
}

const closeActivity = async (page: Page) => {
  if (await screens.activityPanel(page).isVisible()) {
    await page.getByRole('button', { name: /^Activity/ }).click()
  }
  await expect(screens.activityPanel(page)).toBeHidden()
}

test('431 and 432 a picture run on the tiles, then Earlier options', async () => {
  test.setTimeout(240_000)
  session = await openApp({ ADMAN_DEV_TOOLS: '1' })
  stand = await startComfyStandIn()
  const { app, page } = session
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await serveNeedsFromApp(page, stand)
  await screens.saveAddress(await screens.openSettings(page), stand.origin)
  const agent = await agentConnected(page)
  await screens.createProject(page, 'Harbour Lights')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  const layerName = await screens.chooseSlot(page)
  await screens.untickReferences(page)
  await agentRun(page, agent, layerName)

  // A run the server could not finish.
  await screens.chooseProvider(page, 'ComfyUI')
  await screens.setPrompt(page, 'A lantern on a quiet harbour wall')
  await screens.setCount(page, 1)
  await screens.generate(page)
  finishWithError(stand, await nthSentId(stand, 1))
  await expect(screens.runRow(page)).toContainText('Failed', { timeout: 15_000 })

  // 431: three pictures asked, the server holds them.
  await screens.setCount(page, 3)
  await screens.generate(page)
  await nthSentId(stand, 2)
  const panel = screens.picturePanel(page)
  const fresh = panel.getByRole('region', { name: 'New pictures' })
  await expect(fresh.locator('[data-pending]')).toHaveCount(3, { timeout: 15_000 })
  await closeActivity(page)
  await still(page, '431-run-on-tiles')

  // 432: the run done; Earlier options opens for the failed run below it.
  // The pictures go one or more at a time; each is finished as it is sent.
  for (let n = 2; n <= 4; n += 1) finishWithPicture(stand, await nthSentId(stand, n), MOSS_OUTPUT)
  await expect(fresh.getByRole('button', { name: /^Use option/ })).toHaveCount(3, {
    timeout: 20_000,
  })
  const fold = panel.getByRole('button', { name: 'Earlier options' })
  if ((await fold.getAttribute('aria-expanded')) === 'false') await fold.click()
  await expect(panel.getByRole('region', { name: 'Earlier options' })).toContainText('Failed')
  await closeActivity(page)
  await still(page, '432-earlier-options-open')
})
