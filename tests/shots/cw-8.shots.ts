// CW-8 (spec/phases/custom-workflows-slices.md, "CW-8", item 6): 535 the run row of a real
// failed run of a custom workflow whose one node type the stand-in lacks, taken from the
// Activity panel. It replaces CW-7's drawn scene. The workflow is added in Settings through
// the system picker; the run is made from the run dialog against the stand-in on 127.0.0.1.
// Made-up names.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from '@playwright/test'
import { startComfyStandIn, type StandIn } from '../helpers/comfy-stand-in'
import { makeSandbox, launch } from '../e2e/launch'
import * as screens from '../e2e/screens'
import { serveNeedsFromApp } from '../e2e/stand-in-runs'
import { addInSettings, pictureGraph, runDialogWith } from '../e2e/custom-run-steps'
import { closeApp, type Session } from './shot'

const LACKING = 'LensFlarePro'
const NAME = 'Harbour flare'

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

// The picture fixture with one step of a type the stand-in will say it does not have.
function flareGraph() {
  const graph = pictureGraph()
  graph['20'] = { class_type: LACKING, inputs: { images: ['8', 0] }, _meta: { title: 'Flare' } }
  return graph
}

test('535 the run row of a custom workflow the server lacks a node type for', async () => {
  test.setTimeout(180_000)
  const box = makeSandbox()
  const app = await launch(box)
  const page = await app.firstWindow()
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  session = { box, app, page }
  stand = await startComfyStandIn()
  await serveNeedsFromApp(page, stand)
  stand.reply(`GET /object_info/${LACKING}`, { status: 404, json: { error: 'not found' } })
  const comfy = await screens.openSettings(page)
  await screens.saveAddress(comfy, stand.origin)
  await addInSettings(app, page, box, NAME, flareGraph())

  const prompt = 'A harbour at dawn, fishing boats, soft fog'
  const dialog = await runDialogWith(app, page, 'Harbour Mornings', prompt, NAME)
  await dialog.getByRole('button', { name: 'Generate', exact: true }).click()
  const row = screens.runRow(page)
  await expect(row).toContainText('Failed', { timeout: 30_000 })
  await expect(row.getByText(/Press Check in Settings to see them\./)).toBeVisible()
  expect(stand.seen.filter((r) => r.path === '/prompt')).toEqual([])
  await expect(page.locator('body')).not.toContainText(LACKING)

  await row.scrollIntoViewIfNeeded()
  fs.mkdirSync(path.resolve('shots'), { recursive: true })
  const file = path.resolve('shots', '535-run-row-custom-missing.png')
  await screens.activityPanel(page).screenshot({ path: file })
})
