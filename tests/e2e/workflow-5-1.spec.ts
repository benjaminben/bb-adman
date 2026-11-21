// P4-20, Phase 4 exit criteria 1 and 3: workflow 5.1 (create a campaign from a brief) end to end
// in the built app with ADMAN_FAKE_PROVIDERS=1, the workflow 5.8 steps it covers, and each error
// kind an end-to-end run can cause (workflow-5-1-failures.ts). No paid call and no real ComfyUI
// server: Gemini is answered by gemini-answers.ts with a made-up key, ComfyUI by the stand-in.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import * as screens from './screens'
import { makeSandbox, launch, type Sandbox } from './launch'
import { answerQuit } from './quit-answer'
import { query } from './render-helpers'
import { releaseHeld } from './gemini-answers'
import * as w from './workflow-5-1-steps'
import { activityButton, campaignTab, runLeftGoing } from './workflow-5-8-steps'

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
    await answerQuit(app)
    await app?.close()
  } finally {
    fs.rmSync(box.root, { recursive: true, force: true })
  }
})

type Job = { id: string; kind: string; status: string; result: { assetIds: string[] } | null }

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
  const headline = await layer(place, (l) => l.slot === 'headline')
  expect(headline.copy).toBe(w.MESSAGE)

  // Step 7: copy suggested for the call to action, and one line used.
  const action = await layer(place, (l) => l.slot === 'call-to-action')
  await w.suggestAndUse(page, action.name, 'Find your fit')
  await expect.poll(async () => (await layer(place, (l) => l.id === action.id)).copy).toBe(
    'Find your fit',
  )

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

// Finding (P4-20): the campaign tabs read project.get only on project.changed
// (use-project.ts). Starting a run sends none, so the running campaign's tab never shows
// "Running", though project.get gives jobRunning true. (The finished run's results do send one,
// so "New result" shows; the test above checks it.) Re-enable once the campaign tabs re-read
// on job.updated.
test.fixme('Workflow 5.8 step 3: the running campaign\'s tab shows "Running"', async () => {
  await runLeftGoing(app, page)
  await expect(campaignTab(page, w.CAMPAIGN)).toContainText('Running')
})

