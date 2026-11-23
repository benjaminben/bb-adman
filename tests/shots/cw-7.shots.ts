// CW-7 (spec/phases/custom-workflows-slices.md, "CW-7"): 534 the Settings check result with a
// custom workflow whose one node type the stand-in lacks, against the stand-in on 127.0.0.1.
// 535, the run row of that failure, is taken from a real run in cw-8.shots.ts. The workflow is
// a stored file written into the sandbox's userData before the app starts. Made-up names.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from '@playwright/test'
import { startComfyStandIn, type StandIn } from '../helpers/comfy-stand-in'
import { makeSandbox, launch } from '../e2e/launch'
import * as screens from '../e2e/screens'
import { serveNeedsFromApp } from '../e2e/stand-in-runs'
import { closeApp, shot, type Session } from './shot'

const LACKING = 'LensFlarePro'

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
function storedWorkflow() {
  const file = path.resolve('tests/fixtures/comfy-custom/picture.json')
  const graph = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>
  graph['20'] = { class_type: LACKING, inputs: { images: ['8', 0] }, _meta: { title: 'Flare' } }
  return {
    format: 1,
    id: 'custom-0a1b2c3d4e5f',
    name: 'Harbour flare',
    addedBy: 'user',
    addedAt: '2026-11-22T09:00:00.000Z',
    size: { multiple: 16, minPixels: 838_861, maxPixels: 1_048_576 },
    video: null,
    graph,
  }
}

test('CW-7: the check result with a custom workflow missing one node type', async () => {
  test.setTimeout(180_000)
  const box = makeSandbox()
  const dir = path.join(box.userData, 'comfy-workflows')
  fs.mkdirSync(dir)
  const stored = storedWorkflow()
  fs.writeFileSync(path.join(dir, `${stored.id}.json`), JSON.stringify(stored))
  const app = await launch(box)
  const page = await app.firstWindow()
  await page.setViewportSize({ width: 1280, height: 800 })
  session = { box, app, page }
  stand = await startComfyStandIn()
  await serveNeedsFromApp(page, stand)
  stand.reply(`GET /object_info/${LACKING}`, { status: 404, json: { error: 'not found' } })
  const comfy = await screens.openSettings(page)
  await screens.saveAddress(comfy, stand.origin)
  await screens.checkServer(comfy)
  const row = screens.workflowRow(comfy, 'Harbour flare')
  await expect(row.getByText('Added', { exact: true })).toBeVisible()
  await expect(row.getByText(`Node ${LACKING}`)).toBeVisible()
  await row.scrollIntoViewIfNeeded()
  await shot(page, '534-check-result-custom-missing')
})
