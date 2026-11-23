// CW-8 (spec/phases/custom-workflows-slices.md, "CW-8", item 2), offline: the built app driven
// through its screens against the stand-in ComfyUI on 127.0.0.1. Add a fixture workflow in
// Settings, make a picture with it from the run dialog, see the result, then remove it. No
// real server and no paid provider is reached.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'
import { startComfyStandIn, type StandIn } from '../helpers/comfy-stand-in'
import { finishWithPicture, nthSentId, serveNeedsFromApp } from './stand-in-runs'
import * as screens from './screens'
import { addInSettings, pictureGraph, runDialogWith, workflowsSection } from './custom-run-steps'

const NAME = 'Harbour at dusk'
const PROMPT = 'Fishing boats in a quiet harbour at dusk, warm lamps on the water'
// The fixture's output step.
const OUTPUT = '9'

let box: Sandbox
let stand: StandIn
let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  box = makeSandbox()
  stand = await startComfyStandIn()
  app = await launch(box)
  page = await app.firstWindow()
  await serveNeedsFromApp(page, stand)
})
test.afterEach(async () => {
  try {
    await app?.close()
    await stand?.close()
  } finally {
    fs.rmSync(box.root, { recursive: true, force: true })
  }
})

const storedFiles = () => {
  const dir = path.join(box.userData, 'comfy-workflows')
  return fs.existsSync(dir) ? fs.readdirSync(dir) : []
}

const sentGraphs = () =>
  stand.seen
    .filter((r) => r.method === 'POST' && r.path === '/prompt')
    .map((r) => JSON.parse(r.body.toString('utf8')) as { prompt: Record<string, unknown> })

test('a custom workflow: add it in Settings, make a picture with it, remove it', async () => {
  test.setTimeout(180_000)
  const comfy = await screens.openSettings(page)
  await screens.saveAddress(comfy, stand.origin)
  await addInSettings(app, page, box, NAME, pictureGraph())
  expect(storedFiles()).toHaveLength(1)

  const dialog = await runDialogWith(app, page, 'Harbour Lights', PROMPT, NAME)
  await dialog.getByRole('button', { name: 'Generate', exact: true }).click()
  // A custom workflow shows no licence dialog (rule 13).
  await expect(screens.licenceDialog(page)).toHaveCount(0)
  const id = await nthSentId(stand, 1)
  const [sent] = sentGraphs()
  expect(Object.keys(sent?.prompt ?? {}).sort()).toEqual(Object.keys(pictureGraph()).sort())
  expect(sent?.prompt[OUTPUT]).toMatchObject({ class_type: 'PreviewImage' })
  expect(JSON.stringify(sent?.prompt['6'])).toContain(PROMPT)
  finishWithPicture(stand, id, OUTPUT)
  await expect(screens.runRow(page)).toContainText('Done', { timeout: 30_000 })
  await expect(screens.picturePanel(page).getByText(screens.ON_THE_LAYER)).toBeVisible()
  const picture = screens.newPicture(page)
  await expect(picture).toBeVisible()
  expect(await picture.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)

  await screens.openSettingsPage(page, 'AI services')
  const list = workflowsSection(page).getByRole('list', { name: 'Added workflows' })
  await list.getByRole('button', { name: `Remove ${NAME}` }).click()
  const remove = page.getByRole('dialog', { name: `Remove ${NAME}?` })
  await remove.getByRole('button', { name: 'Remove workflow' }).click()
  await expect(workflowsSection(page).getByText('No workflows added yet.')).toBeVisible()
  expect(storedFiles()).toEqual([])
  // The remove sends nothing to the server (rule 10).
  expect(sentGraphs()).toHaveLength(1)
})
