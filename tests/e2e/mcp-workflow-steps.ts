// P10-14: the steps workflow 5.7 and its shots share. Agent access is turned on through Settings
// as the user does, on a free port typed into the Port field, and the address and token are read
// from the Connect panel's text. The token goes to the MCP client only: no helper here prints,
// logs or compares it in a way a failure would show. Not a test file itself. Made-up names only.
import { expect, type ElectronApplication, type Page } from '@playwright/test'
import * as screens from './screens'
import * as v from './variants-steps'
import { freePort } from '../integration/mcp/http-client'
import { toolSession, replyJson, type ToolSession } from '../integration/mcp/tool-client'

export const PROJECT = 'Meadow Market'
export const DIRECTION = 'Direction 1'
export const GERMAN = '1080×1080 · de'

// The Connect panel's value under one of its labels ("Address", "Access token").
function valueUnder(page: Page, label: string) {
  return page
    .getByRole('region', { name: 'Connect to Claude' })
    .getByText(label, { exact: true })
    .locator('xpath=following-sibling::p[1]')
}

// Settings · Agent access: a free port saved, the switch on, the Connect panel read. Gives a
// session of an MCP client in this test process, connected as Claude Code would be.
export async function connectThroughSettings(page: Page): Promise<ToolSession> {
  await screens.openSettingsPage(page, 'Agents')
  const section = page.getByRole('region', { name: 'Agent access' })
  const port = await freePort()
  await section.getByLabel('Port', { exact: true }).fill(String(port))
  await section.getByRole('button', { name: 'Save port' }).click()
  await expect(section.getByLabel('Port', { exact: true })).toHaveValue(String(port))
  await section.getByRole('switch', { name: 'Turn on agent access' }).click()
  await expect(section.getByRole('switch', { name: 'Turn on agent access' })).toBeChecked()
  const address = (await valueUnder(page, 'Address').textContent()) ?? ''
  const token = (await valueUnder(page, 'Access token').textContent()) ?? ''
  // Away from Settings before any check can fail: a failure's page snapshot then holds no token.
  await screens.showStart(page)
  await expect(page.getByRole('region', { name: 'Connect to Claude' })).toHaveCount(0)
  expect(address).toBe(`http://127.0.0.1:${port}/mcp`)
  expect(token.length > 0, 'the Connect panel shows a token').toBe(true)
  return toolSession(port, token)
}

// A project and the e2e brief's campaign in English and German, fanned out to the German variant
// at the master's size, so the master has one linked variant in another language.
export async function campaignInTwoLanguages(app: ElectronApplication, page: Page) {
  await screens.createProject(page, PROJECT)
  await v.createFromForm(app, page, { languages: 'en, de' })
  await v.fanOut(page, DIRECTION, { languages: ['de'] })
  await expect(v.grid(page, DIRECTION).getByRole('listitem')).toHaveCount(2)
}

type Campaign = {
  variants: Array<{ id: string; language: string; isMaster: boolean; title: string }>
}
type Variant = {
  variant: { agentChangedAt: string | null; isMaster: boolean }
  layers: Array<{ id: string; slot: string | null; name: string; type: string }>
}

// What an agent reads first: the open project, its campaign and each variant (steps 1 and 2).
export async function agentReads(s: ToolSession) {
  const [project] = replyJson<Array<{ id: string; name: string }>>(
    await s.call('list_projects', {}),
  )
  const projectId = project!.id
  const read = replyJson<{ campaigns: Array<{ id: string }> }>(
    await s.call('get_project', { project_id: projectId }),
  )
  const campaignId = read.campaigns[0]!.id
  const campaign = replyJson<Campaign>(
    await s.call('get_campaign', { project_id: projectId, campaign_id: campaignId }),
  )
  const variant = (variantId: string) =>
    s
      .call('get_variant', { project_id: projectId, variant_id: variantId })
      .then((r) => replyJson<Variant>(r))
  const master = campaign.variants.find((x) => x.isMaster)!
  const german = campaign.variants.find((x) => x.language === 'de')!
  return { projectId, campaignId, campaign, variant, master, german }
}

export const textLayer = (name: string, copy: string, x: number) => ({
  type: 'text',
  values: {
    name,
    copy,
    style: { fontSize: 48 },
    geometry: { x, y: 80, width: 600, height: 140 },
  },
})
