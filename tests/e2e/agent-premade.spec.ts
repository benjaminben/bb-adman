// An agent builds a campaign from finished pictures in a folder, named by language and size
// (en-1x1.png, fr-4x5.png, ...): it makes a project, imports the files (the test answers the
// dialog as the user would), makes a campaign from a short brief, adds one variant per picture,
// puts each picture on its variant's background and removes the text layers, since the words are
// already in the pictures. No provider call; nothing leaves the computer; drawn pictures only.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'
import { writePng } from './drop-files'
import { connectThroughSettings } from './mcp-workflow-steps'
import { replyJson, type ToolReply, type ToolSession } from '../integration/mcp/tool-client'

const LANGUAGES = ['en', 'fr']
const SIZES = ['1x1', '4x5', '9x16']
const NAMES = LANGUAGES.flatMap((l) => SIZES.map((s) => `${l}-${s}.png`))

const BRIEF = [
  '# Silk Hour launch',
  '',
  'Region: Canada',
  'Audience: Adults 25 to 40 who colour their hair',
  'Message: Soft hair, every hour.',
  `Languages: ${LANGUAGES.join(', ')}`,
  `Sizes: ${SIZES.join(', ')}`,
  '',
  '## Subjects',
  '',
  '### Silk Hour shampoo',
].join('\n')

type Campaign = {
  directions: Array<{ id: string }>
  variants: Array<{ id: string; language: string; sizeLabel: string; isMaster: boolean }>
}
type Variant = { layers: Array<{ id: string; type: string; source: { assetId: string } | null }> }

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

const ok = <T>(reply: ToolReply): T => {
  expect(reply.isError, JSON.stringify(reply)).toBeFalsy()
  return replyJson<T>(reply)
}

test('an agent makes a campaign from finished pictures named by language and size', async () => {
  test.setTimeout(240_000)
  const tool: ToolSession = await connectThroughSettings(page)
  const dir = path.join(fs.realpathSync(box.root), 'Finished ads')
  fs.mkdirSync(dir)
  const files = NAMES.map((n) => path.join(dir, n))
  files.forEach((f, i) => writePng(f, [30 + i * 35, 120, 200 - i * 25]))

  const { projectId } = ok<{ projectId: string }>(
    await tool.call('create_project', { name: 'Silk Hour' }),
  )
  const importing = tool.call('import_assets', { project_id: projectId, paths: files })
  const dialog = page.getByRole('dialog', { name: 'An agent asks to import files' })
  await expect(dialog).toBeVisible({ timeout: 30_000 })
  await dialog.getByRole('button', { name: 'Import' }).click()
  const { assetIds } = ok<{ assetIds: string[] }>(await importing)
  expect(assetIds).toHaveLength(NAMES.length)
  const assetOf = (language: string, size: string) =>
    assetIds[NAMES.indexOf(`${language}-${size}.png`)]!

  const made = ok<{ campaignId: string; directionId: string; masterVariantId: string }>(
    await tool.call('create_campaign_from_brief', { project_id: projectId, text: BRIEF }),
  )
  const read = () =>
    tool
      .call('get_campaign', { project_id: projectId, campaign_id: made.campaignId })
      .then((r) => ok<Campaign>(r))
  const master = (await read()).variants.find((v) => v.isMaster)!

  for (const language of LANGUAGES)
    for (const size of SIZES) {
      if (language === master.language && size === master.sizeLabel) continue
      ok(
        await tool.call('add_variant', {
          project_id: projectId,
          direction_id: made.directionId,
          size_label: size,
          language,
          format: 'image',
        }),
      )
    }
  const campaign = await read()
  expect(campaign.variants).toHaveLength(NAMES.length)

  for (const v of campaign.variants) {
    const variant = () =>
      tool
        .call('get_variant', { project_id: projectId, variant_id: v.id })
        .then((r) => ok<Variant>(r))
    const before = await variant()
    const background = before.layers.find((l) => l.type === 'background')!
    const assetId = assetOf(v.language, v.sizeLabel)
    ok(
      await tool.call('update_layer', {
        project_id: projectId,
        layer_id: background.id,
        patch: { source: { assetId } },
      }),
    )
    for (const text of before.layers.filter((l) => l.type === 'text'))
      ok(await tool.call('delete_layer', { project_id: projectId, layer_id: text.id }))
    const after = await variant()
    expect(after.layers.filter((l) => l.type === 'text')).toHaveLength(0)
    expect(after.layers.find((l) => l.type === 'background')!.source).toEqual({ assetId })
    const drawn = await tool.call('render_variant', { project_id: projectId, variant_id: v.id })
    expect(drawn.isError, JSON.stringify(drawn).slice(0, 400)).toBeFalsy()
  }
})
