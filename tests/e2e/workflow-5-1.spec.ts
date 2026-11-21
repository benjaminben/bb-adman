// P4-20, Phase 4 exit criteria 1 and 3: workflow 5.1 (create a campaign from a brief) end to end
// in the built app with ADMAN_FAKE_PROVIDERS=1, the workflow 5.8 steps it covers, and each error
// kind an end-to-end run can cause (workflow-5-1-failures.ts). No paid call and no real ComfyUI
// server: Gemini is answered by gemini-answers.ts with a made-up key, ComfyUI by the stand-in.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import * as screens from './screens'
import { makeSandbox, launch, type Sandbox } from './launch'
import { answerQuit } from './quit-answer'
import { command, query } from './render-helpers'
import { MADE_UP_KEY } from './gemini-stand-in'
import { installGemini, releaseHeld } from './gemini-answers'
import { startComfyStandIn, type StandIn } from '../helpers/comfy-stand-in'
import { serveNeedsFromApp } from './stand-in-runs'
import * as w from './workflow-5-1-steps'
import * as f from './workflow-5-1-failures'
import { activityButton, campaignTab, runLeftGoing } from './workflow-5-8-steps'

let box: Sandbox
let app: ElectronApplication
let page: Page
let stand: StandIn | undefined

// The hand-test tools are on so the stand-in's `trial` ComfyUI workflow is offered.
test.beforeEach(async () => {
  box = makeSandbox()
  app = await launch(box, [], { ADMAN_DEV_TOOLS: '1' })
  page = await app.firstWindow()
})
test.afterEach(async () => {
  try {
    await answerQuit(app)
    await app?.close()
    await stand?.close()
  } finally {
    stand = undefined
    fs.rmSync(box.root, { recursive: true, force: true })
  }
})

type Job = {
  id: string
  kind: string
  status: string
  seenAt: string | null
  result: { assetIds: string[] } | null
}

async function jobs(place: w.Place, layerId?: string): Promise<Job[]> {
  const input = { projectId: place.projectId, ...(layerId ? { layerId } : {}) }
  return (await query(page, 'job.list', input)) as unknown as Job[]
}

async function layer(place: w.Place, pick: (l: w.Layer) => boolean): Promise<w.Layer> {
  return (await w.layersOf(page, place)).find(pick)!
}

test('Workflow 5.1: a campaign from a Markdown brief, its pictures, text and cut-out', async () => {
  test.setTimeout(120_000)
  // Steps 1 to 3: the brief read with AI, corrected, and the campaign created.
  await screens.createProject(page, 'Harbour')
  await w.readBriefAndCreate(app, page)
  const place = await w.placeOf(page, w.CAMPAIGN)

  // Steps 4 and 5: the master in the editor; pictures for the background, one used.
  await w.openMaster(page)
  const background = await layer(place, (l) => l.type === 'background')
  await w.selectLayer(page, background.name)
  await w.makePictures(page, 2)
  await w.useOption(page, 2)
  const [made] = (await jobs(place, background.id)).filter((j) => j.kind === 'image_generation')
  await expect
    .poll(async () => (await layer(place, (l) => l.id === background.id)).source?.assetId)
    .toBe(made!.result!.assetIds[1])

  // Step 6: the text placed by the layout; the campaign message is kept word for word.
  await w.placeText(page)
  await expect
    .poll(async () => (await jobs(place)).find((j) => j.kind === 'layout_proposal')?.status)
    .toBe('succeeded')
  // Its result is on the layers, so the window marked it seen (spec/jobs.md [FR-218]).
  await expect
    .poll(async () => (await jobs(place)).find((j) => j.kind === 'layout_proposal')?.seenAt)
    .toEqual(expect.any(String))
  const headline = await layer(place, (l) => l.slot === 'headline')
  expect(headline.copy).toBe(w.MESSAGE)

  // Step 7: copy suggested for the call to action, and one line used.
  const action = await layer(place, (l) => l.slot === 'call-to-action')
  await w.suggestAndUse(page, action.name, 'Find your fit')
  await expect
    .poll(async () => (await layer(place, (l) => l.id === action.id)).copy)
    .toBe('Find your fit')

  // Step 7: a subject picture layer, its picture made and used, then cut out and the cut-out used.
  await page.getByRole('button', { name: 'Add picture layer' }).click()
  const subject = await layer(place, (l) => l.type === 'image')
  await w.makePictures(page, 1)
  await w.useOption(page, 1)
  await w.cutOut(page)
  await w.useOption(page, 1)
  const cut = (await jobs(place, subject.id)).find((j) => j.kind === 'cutout')!
  await expect
    .poll(async () => (await layer(place, (l) => l.id === subject.id)).source?.assetId)
    .toBe(cut.result!.assetIds[0])
})

test('Workflow 5.8: a run left going while the user works in another campaign', async () => {
  test.setTimeout(120_000)
  const place = await runLeftGoing(app, page)
  await expect(activityButton(page)).toContainText('1 running')

  // Step 4: the run finishes; its campaign's tab and the Activity button show a result not yet
  // looked at.
  await releaseHeld(app, 'picture')
  const first = campaignTab(page, w.CAMPAIGN)
  await expect(first.getByRole('img', { name: 'New result' })).toBeVisible({ timeout: 15_000 })
  await expect(activityButton(page)).not.toContainText('running')
  await expect(activityButton(page).getByRole('img', { name: 'New results' })).toBeVisible()
  await expect(page.getByRole('heading', { name: screens.E2E_CAMPAIGN, level: 2 })).toBeVisible()

  // Steps 4 and 5: the panel lists it with its campaign, variant and layer; Go there shows the
  // run's options with no new run; the user picks one and the "New" mark goes.
  await activityButton(page).click()
  const rows = page.getByRole('region', { name: 'Activity' }).getByRole('listitem')
  const done = rows.filter({ hasText: 'New' })
  await expect(done).toContainText(`${w.CAMPAIGN} › `)
  await done.getByRole('button', { name: new RegExp(`^Go to ${w.CAMPAIGN} › `) }).click()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
  await expect(w.earlierOptions(page).getByText(/· Google Gemini · Pictures$/)).toBeVisible()
  await w.useOption(page, 1)
  await expect(activityButton(page).getByRole('img', { name: 'New results' })).toHaveCount(0)
  await expect(first.getByRole('img', { name: 'New result' })).toHaveCount(0)
  expect((await jobs(place)).filter((j) => j.kind === 'image_generation')).toHaveLength(1)

  // Step 6: the other campaign's tab is as the user left it.
  await campaignTab(page, screens.E2E_CAMPAIGN).click()
  await expect(page.getByRole('heading', { name: screens.E2E_CAMPAIGN, level: 2 })).toBeVisible()
})

// Workflow 5.8 step 3 [FR-218]: the campaign tabs re-read project.get when a job of the project
// moves between running, not looked at and neither (use-project.ts), so the running campaign's
// tab shows "Running" while the run goes on, and a dot in its place once it finishes.
test('Workflow 5.8 step 3: the running campaign\'s tab shows "Running"', async () => {
  test.setTimeout(120_000)
  await runLeftGoing(app, page)
  const tab = campaignTab(page, w.CAMPAIGN)
  await expect(tab).toContainText('Running')
  await expect(campaignTab(page, screens.E2E_CAMPAIGN)).not.toContainText('Running')
  await releaseHeld(app, 'picture')
  await expect(tab.getByRole('img', { name: 'New result' })).toBeVisible({ timeout: 15_000 })
  await expect(tab).not.toContainText('Running')

  // With the Activity panel open, the campaign page's fields end where the panel begins.
  await activityButton(page).click()
  const panel = await page.getByRole('region', { name: 'Activity' }).boundingBox()
  const prompt = page.getByRole('textbox', { name: 'Prompt' }).first()
  const field = await prompt.boundingBox()
  expect(field!.x + field!.width).toBeLessThanOrEqual(panel!.x)
})

test('A failed run of each kind shows its sentence and Retry, in earlier options and Activity', async () => {
  test.setTimeout(120_000)
  stand = await startComfyStandIn()
  await serveNeedsFromApp(page, stand)
  await screens.saveAddress(await screens.openSettings(page), stand.origin)
  await installGemini(app)
  await command(page, 'secret.set', { name: 'gemini.apiKey', value: MADE_UP_KEY })
  await screens.createProject(page, 'Harbour')
  await w.readBriefAndCreate(app, page)
  const place = await w.placeOf(page, w.CAMPAIGN)
  const background = await layer(place, (l) => l.type === 'background')
  await f.failEachGeminiKind(app, page, place, background.id)
  await f.failOnComfy(page, stand, place, background.id)
  const sentences = [...f.GEMINI_KINDS.map(f.geminiSentence), f.COMFY_SENTENCE]

  // The layer's earlier options; Retry of a paid run asks first, and the layer keeps no picture.
  await w.openMaster(page)
  await w.selectLayer(page, background.name)
  const earlier = w.earlierOptions(page)
  for (const sentence of sentences) await f.expectFailure(earlier, sentence)
  const quota = await f.expectFailure(earlier, f.geminiSentence('quota'))
  await quota.getByRole('button', { name: 'Retry' }).click()
  const again = page.getByRole('dialog', { name: 'Retry the run' })
  await expect(again).toContainText('Google Gemini')
  await again.getByRole('button', { name: 'Cancel' }).click()
  expect((await layer(place, (l) => l.id === background.id)).source).toBeNull()

  // The activity panel; Retry of a paid row asks first too.
  await activityButton(page).click()
  const panel = page.getByRole('region', { name: 'Activity' })
  for (const sentence of sentences) await f.expectFailure(panel, sentence)
  const offline = await f.expectFailure(panel, f.geminiSentence('offline'))
  await offline.getByRole('button', { name: 'Retry' }).click()
  const retry = page.getByRole('dialog', { name: 'Retry' })
  await expect(retry.getByText('Provider: Google Gemini')).toBeVisible()
  await retry.getByRole('button', { name: 'Cancel' }).click()
})
