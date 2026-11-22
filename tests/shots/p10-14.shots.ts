// P10-14: workflow 5.7 as the user sees it. 297 the campaign after an agent's edits (the German
// variant out of date after the agent's master edit), 298 the German variant's tab with the
// agent-made layer selected, 299 the activity line while the agent works. Agent access is turned
// on through Settings first; no picture shows Settings, so none shows the token. Fake providers
// only; nothing is paid and nothing leaves the machine. Made-up names only.
import { test, expect } from '@playwright/test'
import * as v from '../e2e/variants-steps'
import { replyJson } from '../integration/mcp/tool-client'
import {
  agentReads,
  campaignInTwoLanguages,
  connectThroughSettings,
} from '../e2e/mcp-workflow-steps'
import { DIRECTION, GERMAN, PROJECT, textLayer } from '../e2e/mcp-workflow-steps'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

test('P10-14 shots', async () => {
  test.setTimeout(240_000)
  session = await openApp()
  const { app, page } = session
  const s = await connectThroughSettings(page)
  await campaignInTwoLanguages(app, page)
  const a = await agentReads(s)

  await v.tileButton(v.tile(page, DIRECTION, GERMAN)).dblclick()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
  const made = await s.call('create_layer', {
    project_id: a.projectId,
    variant_id: a.german.id,
    ...textLayer('Market note', 'Jeden Samstag frisch', 220),
  })
  const { layerId } = replyJson<{ layerId: string }>(made)
  const line = page.getByRole('status').filter({ hasText: 'Agent working:' })
  await expect(line).toHaveText(`Agent working: create_layer · ${PROJECT}`)
  await shot(page, '299-agent-activity-during-run')

  await s.call('update_layer', {
    project_id: a.projectId,
    layer_id: layerId,
    patch: { style: { color: '#2E7D32' } },
  })
  const rows = page.getByRole('list', { name: 'Layers' })
  await rows.getByRole('button', { name: /^Market note/ }).click()
  await expect(
    page.getByRole('region', { name: 'Properties' }).getByLabel('Copy', { exact: true }),
  ).toHaveValue('Jeden Samstag frisch')
  await shot(page, '298-variant-tab-agent-layer')

  await v.showOverview(page)
  const master = await a.variant(a.master.id)
  const headline = master.layers.find((l) => l.slot === 'headline')!
  await s.call('update_layer', {
    project_id: a.projectId,
    layer_id: headline.id,
    patch: { style: { color: '#1F6FEB' } },
  })
  await expect(v.tile(page, DIRECTION, GERMAN).getByText('Out of date')).toBeVisible()
  await expect(line).toBeHidden({ timeout: 15_000 })
  await shot(page, '297-campaign-after-agent-edits')
})
