// P10-14, Phase 10 exit criterion 1: workflow 5.7 (place copy with an external agent) end to end
// in the built app with ADMAN_FAKE_PROVIDERS=1. The user turns on agent access in Settings and
// the MCP client in this test process connects with the address and token the Connect panel
// shows. The agent reads the campaign and renders each variant, creates and moves text layers
// that show in the open editor as they happen, and the user undoes one with the editor's Undo
// (agents are denied undo). Then a translation the agent sets shows as proposed, not approved,
// and an agent's master edit marks the linked variant out of date. No paid call; nothing leaves
// the computer; the token is never printed. Made-up names only.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import { makeSandbox, launch, type Sandbox } from './launch'
import * as v from './variants-steps'
import { replyJson } from '../integration/mcp/tool-client'
import { agentReads, campaignInTwoLanguages, connectThroughSettings } from './mcp-workflow-steps'
import { DIRECTION, GERMAN, textLayer } from './mcp-workflow-steps'

let box: Sandbox
let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  box = makeSandbox()
  app = await launch(box)
  page = await app.firstWindow()
})
test.afterEach(async () => {
  try {
    await app?.close()
  } finally {
    fs.rmSync(box.root, { recursive: true, force: true })
  }
})

const layers = (p: Page) => p.getByRole('list', { name: 'Layers' })
const row = (p: Page, name: string) =>
  layers(p).getByRole('button', { name: new RegExp(`^${name}`) })
const properties = (p: Page) => p.getByRole('region', { name: 'Properties' })

test('Workflow 5.7: an agent reads, renders and places copy; the user watches and undoes', async () => {
  test.setTimeout(240_000)
  const s = await connectThroughSettings(page)
  await campaignInTwoLanguages(app, page)

  // Steps 1 and 2: the agent reads the campaign and each variant, and renders each as a PNG.
  const a = await agentReads(s)
  expect(a.campaign.variants).toHaveLength(2)
  for (const one of a.campaign.variants) {
    const read = await a.variant(one.id)
    expect(read.layers.some((l) => l.slot === 'headline')).toBe(true)
    const picture = await s.call('render_variant', {
      project_id: a.projectId,
      variant_id: one.id,
      max_dimension: 256,
    })
    expect(picture.isError).toBeFalsy()
    expect(picture.content?.map((item) => item.type)).toEqual(['image'])
  }

  // Steps 3 and 4: the German variant open in the editor; the agent's layers appear in it.
  await v.tileButton(v.tile(page, DIRECTION, GERMAN)).dblclick()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
  const create = (name: string, copy: string, x: number) =>
    s.call('create_layer', {
      project_id: a.projectId,
      variant_id: a.german.id,
      ...textLayer(name, copy, x),
    })
  const first = replyJson<{ layerId: string }>(
    await create('Market note', 'Fresh every Saturday', 80),
  )
  await expect(row(page, 'Market note')).toBeVisible()
  await row(page, 'Market note').click()
  const x = properties(page).getByLabel('X', { exact: true })
  await expect(x).toHaveValue('80')

  const moved = await s.call('update_layer', {
    project_id: a.projectId,
    layer_id: first.layerId,
    patch: { geometry: { x: 360 }, style: { color: '#2E7D32' } },
  })
  expect(moved.isError).toBeFalsy()
  await expect(x).toHaveValue('360')

  expect((await create('Opening hours', 'Open from eight', 120)).isError).toBeFalsy()
  await expect(row(page, 'Opening hours')).toBeVisible()
  const read = await a.variant(a.german.id)
  expect(read.variant.agentChangedAt).not.toBeNull()

  // No tool undoes (agents are denied undo); the user's Undo takes back the agent's last layer.
  expect((await s.list()).some((t) => /undo|redo/.test(t.name))).toBe(false)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(row(page, 'Opening hours')).toHaveCount(0)
  await expect(row(page, 'Market note')).toBeVisible()

  // Step 5: the agent sets the German headline; it shows as proposed, from an agent.
  const headline = read.layers.find((l) => l.slot === 'headline')!
  const set = await s.call('set_translation', {
    project_id: a.projectId,
    layer_id: headline.id,
    text: 'Kühl bleiben mit jedem Schluck',
    apply_to_same_language: false,
  })
  expect(set.isError).toBeFalsy()
  await row(page, headline.name).click()
  await expect(properties(page).getByText('Translation: Proposed, from an agent')).toBeVisible()
  await expect(properties(page).getByRole('button', { name: 'Approve' })).toBeVisible()

  // Step 6: the agent edits the master's headline; the German variant goes out of date.
  await v.showOverview(page)
  await expect(v.outOfDate(page, DIRECTION)).toHaveCount(0)
  const masterRead = await a.variant(a.master.id)
  const masterHeadline = masterRead.layers.find((l) => l.slot === 'headline')!
  const edit = await s.call('update_layer', {
    project_id: a.projectId,
    layer_id: masterHeadline.id,
    patch: { style: { color: '#1F6FEB' } },
  })
  expect(edit.isError).toBeFalsy()
  await expect(
    v.tile(page, DIRECTION, GERMAN).getByTitle('Out of date', { exact: true }),
  ).toBeVisible()
  await expect(
    v.section(page, DIRECTION).getByRole('button', { name: 'Sync 1 out of date…' }),
  ).toBeEnabled()
})
