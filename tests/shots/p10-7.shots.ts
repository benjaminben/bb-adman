// P10-7: the permission dialog and the delete setting. An MCP client on this machine asks
// delete_campaign; the dialog opens, is pictured and refused, so nothing is deleted. 290 the
// dialog, 291 the dialog with a long target, 292 the Settings checkbox. Nothing is paid and
// nothing leaves the machine. Made-up names only.
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import { command, query } from '../e2e/render-helpers'
import { toolSession, type ToolSession } from '../integration/mcp/tool-client'
import { freePort } from '../integration/mcp/http-client'
import { closeApp, openApp, shot, type Session } from './shot'

const LONG_PROJECT = 'Harbour Lights Autumn and Winter Collection for the Northern Coast Shops'
const LONG_CAMPAIGN =
  'Slow Evenings by the Harbour with a Warm Cup of Tea for Commuters on the Late Ferry Home'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

async function projectWithCampaign(page: Page, project: string, campaign: string) {
  await screens.createProject(page, project)
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string; name: string }[]
  }
  const projectId = state.openProjects.find((p) => p.name === project)!.projectId
  const { campaignId } = (await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: campaign,
      region: 'US',
      audience: 'Commuters who like a warm cup',
      message: 'Slow down with a cup at dusk',
      subjects: [{ name: 'Tea tin' }],
    },
    subjectMap: [{ subjectId: 'tea-tin', create: true }],
    languages: ['en'],
    sizes: [
      { label: '1080x1080', width: 1080, height: 1080 },
      { label: '1080x1920', width: 1080, height: 1920 },
    ],
    templateId: 'starter',
  })) as { campaignId: string }
  return { projectId, campaignId }
}

// Asks, pictures the dialog, then refuses it so the call ends with nothing deleted.
async function askAndShoot(page: Page, s: ToolSession, ids: object, name: string) {
  const at = ids as { projectId: string; campaignId: string }
  const pending = s.call('delete_campaign', {
    project_id: at.projectId,
    campaign_id: at.campaignId,
  })
  const dialog = page.getByRole('dialog', { name: 'An agent asks to delete' })
  await expect(dialog).toBeVisible({ timeout: 30_000 })
  await expect(dialog.getByRole('button', { name: 'Refuse' })).toBeFocused()
  await shot(page, name)
  await dialog.getByRole('button', { name: 'Refuse' }).click()
  await expect(dialog).toBeHidden()
  expect((await pending).isError).toBe(true)
}

test('P10-7 shots', async () => {
  test.setTimeout(240_000)
  session = await openApp()
  const { page } = session
  const port = await freePort()
  await command(page, 'settings.update', { mcp: { port } })
  await command(page, 'mcp.setEnabled', { enabled: true })
  const { token } = (await query(page, 'mcp.getConnectInfo', {})) as { token: string }
  const s = await toolSession(port, token)

  const short = await projectWithCampaign(page, 'Harbour Lights', 'Harbour Lights Tea')
  await askAndShoot(page, s, short, '290-permission-dialog')

  const long = await projectWithCampaign(page, LONG_PROJECT, LONG_CAMPAIGN)
  await askAndShoot(page, s, long, '291-permission-dialog-long-target')

  await screens.openSettings(page)
  const box = page.getByRole('checkbox', {
    name: 'Let agents delete campaigns and variants without asking',
  })
  await box.scrollIntoViewIfNeeded()
  await expect(box).toBeVisible()
  await shot(page, '292-settings-delete-without-asking')
})
