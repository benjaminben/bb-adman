// SPEC 14 1.56 E2E-R, the offline spec: the built app driven through its screens against the
// stand-in ComfyUI on 127.0.0.1, with the hand-test tools on so trial workflows are offered.
// No real server, no paid provider and no network beyond 127.0.0.1 is reached: Gemini is
// answered inside the app's main process by gemini-stand-in.ts. TP-6's video start is here,
// and CU-6b-R's video from a picture (1.60 N-11); the rows that need no stand-in are in
// screen-tour.spec.ts (1.59 L-12). CAMP-7: pictures are made in the editor's Generate panel
// and the runs are read from the Activity panel (screens.ts, picture-run.ts).
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'
import { startComfyStandIn, type StandIn } from '../helpers/comfy-stand-in'
import { greyPng } from '@/main/providers/fake/png'
import {
  finishWithError,
  finishWithPicture,
  finishWithVideo,
  nthSentId,
  serveNeedsFromApp,
  startWorking,
  waitingInQueue,
} from './stand-in-runs'
import * as screens from './screens'
import * as video from './video-screens'
import { reopenAsVideo } from './timeline-seed'
import { lastGraph, pngSize, runSize, uploads, type Upload } from './stand-in-uploads'
import { uploadName } from '@/main/providers/comfyui/values'
import { pictureType } from '@/main/providers/picture-type'
import { geminiAsked, MADE_UP_KEY, standInForGemini, standInInstalled } from './gemini-stand-in'
import { GEMINI_ORIGIN } from '@/main/providers/gemini/pinned-origin'

const MOSS_OUTPUT = '9'
const FLUX_OUTPUT = '15'
const H3_TEXT_OUTPUT = '14'

let box: Sandbox
let stand: StandIn
let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  box = makeSandbox()
  stand = await startComfyStandIn()
  app = await launch(box, [], { ADMAN_DEV_TOOLS: '1' })
  page = await app.firstWindow()
  await serveNeedsFromApp(page, stand)
})
// The sandbox holds the saved address and any typed key, so it is removed even if a close fails.
test.afterEach(async () => {
  try {
    await app?.close()
    await stand?.close()
  } finally {
    fs.rmSync(box.root, { recursive: true, force: true })
  }
})

// The project, the campaign from the test brief, and the stand-in's address saved; the master
// open in the editor on its background layer. A video start needs a video post

// (P7-11), so `asVideo` reopens the project with its first variant one.
async function campaignOnStandIn(asVideo = false): Promise<void> {
  const comfy = await screens.openSettings(page)
  await screens.saveAddress(comfy, stand.origin)
  await screens.createProject(page, 'Stand-in')
  await screens.loadBriefAndCreate(app, page)
  if (asVideo) await reopenAsVideo(page, 'Stand-in')
  await screens.openCampaign(page)
  await screens.chooseSlot(page)
  // SP-5: these runs are not about the subject's photo, so it is not sent.
  await screens.untickReferences(page)
  await screens.chooseProvider(page, 'ComfyUI')
  await screens.setPrompt(page, screens.E2E_PROMPT)
  await screens.setCount(page, 1)
}

// The typed prompt is the one the app sent to the stand-in in its newest run.
function lastSentPrompt(): string {
  const posts = stand.seen.filter((r) => r.method === 'POST' && r.path === '/prompt')
  return posts.at(-1)?.body.toString('utf8') ?? ''
}

const generate = () => screens.generate(page)

test('Settings: a refused address, then the stand-in saved, checked per workflow and removed', async () => {
  const comfy = await screens.openSettings(page)
  await comfy.getByLabel('Server address').fill('ftp://127.0.0.1:21')
  await comfy.getByRole('button', { name: 'Save' }).click()
  await expect(comfy.locator('#comfy-address-refusal')).toBeVisible()
  await expect(comfy.getByText('Not set', { exact: true })).toBeVisible()
  const banner = page.getByRole('alert')
  await expect(banner).toBeVisible()
  await banner.getByRole('button', { name: 'Dismiss' }).click()
  await expect(banner).toBeHidden()

  await screens.saveAddress(comfy, stand.origin)
  await screens.checkServer(comfy)
  await expect(screens.workflowRow(comfy, screens.MOSS_LABEL)).toContainText('Complete')
  await expect(screens.workflowRow(comfy, screens.FLUX_LABEL)).toContainText('Complete')
  await expect(screens.workflowRow(comfy, screens.H3_TEXT_LABEL)).toContainText('Complete')
  // The real Settings case's check (1.59 L-13): every row shows a result.
  const rows = await screens.workflowRows(comfy).all()
  expect(rows.length).toBeGreaterThan(2)
  for (const row of rows) await expect(row).toContainText(screens.CHECK_RESULT)
  // The check only asks: GETs and nothing else.
  expect(stand.seen.length).toBeGreaterThan(0)
  expect(stand.seen.filter((r) => r.method !== 'GET')).toEqual([])

  await comfy.getByRole('button', { name: 'Remove' }).click()
  await expect(comfy.getByText('Not set', { exact: true })).toBeVisible()
})

test('Campaign: a run waits, works and is done; a failed run is retried; a waiting run is cancelled', async () => {
  await campaignOnStandIn()

  await generate()
  const first = await nthSentId(stand, 1)
  expect(lastSentPrompt()).toContain(screens.E2E_PROMPT)
  await expect(screens.runRow(page)).toContainText(screens.WAITING_ON_SERVER)
  startWorking(stand, first)
  await expect(screens.runRow(page)).toContainText(screens.WORKING_ON_SERVER, {
    timeout: 15_000,
  })
  finishWithPicture(stand, first, MOSS_OUTPUT)
  await expect(screens.runRow(page)).toContainText('Done', { timeout: 15_000 })
  await expect(screens.picturePanel(page).getByText(screens.ON_THE_LAYER)).toBeVisible()
  const picture = screens.newPicture(page)
  await expect(picture).toBeVisible()
  expect(await picture.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)

  await generate()
  finishWithError(stand, await nthSentId(stand, 2))
  await expect(screens.runRow(page)).toContainText('Failed', { timeout: 15_000 })
  await screens.runRow(page).getByRole('button', { name: 'Retry' }).click()
  finishWithPicture(stand, await nthSentId(stand, 3), MOSS_OUTPUT)
  await expect(screens.runRow(page)).toContainText('Done', { timeout: 15_000 })

  await generate()
  waitingInQueue(stand, await nthSentId(stand, 4))
  await expect(screens.runRow(page)).toContainText(screens.WAITING_ON_SERVER)
  await screens.runRow(page).getByRole('button', { name: 'Cancel' }).click()
  await expect(screens.runRow(page)).toContainText('Cancelled', { timeout: 15_000 })
})

// The paid run's cost is on screen in the run dialog at the click that sends it (C-15).
const PAID_LINE = /^Paid: 1 picture.* to Google Gemini$/

test("References and the paid confirm: an added picture goes to Flux; Gemini's confirm is cancelled", async () => {
  await campaignOnStandIn()
  const file = path.join(box.root, 'reference.png')
  fs.writeFileSync(file, greyPng(32, 24))

  const panel = screens.picturePanel(page)
  await panel.getByRole('button', { name: 'Choose reference pictures…' }).click()
  const chooser = page.getByRole('dialog', { name: /^Reference pictures for / })
  await screens.answerOpenDialog(app, [file])
  const references = chooser.getByRole('region', { name: 'Reference pictures' })
  await references.getByRole('button', { name: 'Add pictures' }).click()
  // SP-5: the list also holds the subject's photo (unticked above); this is the added one.
  const tick = references.getByRole('checkbox', { name: 'reference.png', exact: true })
  await expect(tick).toHaveCount(1)
  await tick.check()
  await chooser.getByRole('button', { name: 'Done' }).click()
  await expect(panel.getByText('1 chosen', { exact: true })).toBeVisible()
  await generate()
  await screens.confirmLicence(page)
  finishWithPicture(stand, await nthSentId(stand, 1), FLUX_OUTPUT)
  await expect(screens.runRow(page)).toContainText('Done', { timeout: 15_000 })
  expect(stand.seen.some((r) => r.method === 'POST' && r.path === '/upload/image')).toBe(true)

  await screens.chooseProvider(page, 'Google Gemini')
  const run = await screens.openRunDialog(page)
  await expect(run.getByText(PAID_LINE)).toBeVisible()
  await run.getByRole('button', { name: 'Cancel' }).click()
  await expect(run).toBeHidden()
  await expect(panel.getByRole('button', { name: 'Generate…' })).toBeVisible()
  await expect(screens.runRows(page)).toHaveCount(1)
})

test('Key dialog and paid Retry: Cancel, then a made-up key saved; the refused run is retried', async () => {
  await campaignOnStandIn()
  await standInForGemini(app)
  await screens.chooseProvider(page, 'Google Gemini')
  const dialog = page.getByRole('dialog', { name: 'Add your Google Gemini key' })

  const run = await screens.openRunDialog(page)
  await expect(run.getByText(PAID_LINE)).toBeVisible()
  await run.getByRole('button', { name: 'Generate', exact: true }).click()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
  if (await run.isVisible()) await run.getByRole('button', { name: 'Cancel' }).click()
  await expect(run).toBeHidden()
  await expect(screens.runRows(page)).toHaveCount(0)
  expect(await geminiAsked(app)).toEqual([])

  await generate()
  await dialog.getByLabel('API key').fill(MADE_UP_KEY)
  // Re-review S-A: the main process's fetch is the stand-in before the key can be sent.
  expect(await standInInstalled(app)).toBe(true)
  await dialog.getByRole('button', { name: 'Save and continue' }).click()
  await expect(dialog).toBeHidden()
  await expect(screens.runRow(page)).toContainText('Failed', { timeout: 15_000 })
  expect(await geminiAsked(app)).toEqual([GEMINI_ORIGIN])

  // A paid Retry from Activity goes through the run dialog in retry mode, its cost shown.
  const row = screens.runRow(page)
  const retry = page.getByRole('dialog', { name: 'Retry the run' })
  await row.getByRole('button', { name: 'Retry' }).click()
  await expect(retry.getByText(PAID_LINE)).toBeVisible()
  await retry.getByRole('button', { name: 'Cancel' }).click()
  await expect(retry).toBeHidden()
  expect(await geminiAsked(app)).toEqual([GEMINI_ORIGIN])
  await row.getByRole('button', { name: 'Retry' }).click()
  await retry.getByRole('button', { name: 'Retry' }).click()
  await expect.poll(() => geminiAsked(app)).toEqual([GEMINI_ORIGIN, GEMINI_ORIGIN])
  await expect(screens.runRow(page)).toContainText('Failed', { timeout: 15_000 })
})

// SPEC 14 1.57 TP-6: the clip's metadata loads in the built app, so its CSP (media-src) and
// the adman-asset:// protocol let a video through.
test('Make a video: a 2-second clip from a prompt is started, done and has its metadata', async () => {
  await campaignOnStandIn(true)
  await screens.startVideo(page, 2)
  await screens.confirmLicence(page)
  const id = await nthSentId(stand, 1)
  expect(lastSentPrompt()).toContain(screens.E2E_VIDEO_PROMPT)
  await expect(screens.runRow(page)).toContainText('Video')
  finishWithVideo(stand, id, H3_TEXT_OUTPUT)
  await expect(screens.runRow(page)).toContainText('Done', { timeout: 15_000 })
  await screens.clipHasMetadata(page, 15_000)
})

// SPEC 14 1.60 CU-6b-R N-11 and CU-6b-F N-3: a 200 x 199 picture made here is the first frame.
// R2E-9: the Generate panel lists only pictures of the 1:1 post's shape (within 1%), so it is
// nearly square. The built app's fitPicture (Electron's nativeImage) crops and scales it, so
// the one upload is a PNG at the run's size under the app's own name, and the graph names it.
test('Make a video from a first-frame picture: the upload is a PNG at the run size', async () => {
  await campaignOnStandIn(true)
  const file = path.join(box.root, 'first-frame.png')
  fs.writeFileSync(file, greyPng(200, 199))
  await screens.startFromAddedPicture(app, page, video.FIRST_FRAME_START, file)
  await screens.startVideo(page, 2)
  await screens.confirmLicence(page)
  const id = await nthSentId(stand, 1)
  const sent = uploads(stand)
  expect(sent).toHaveLength(1)
  const [frame] = sent as [Upload]
  expect(frame.name).toBe(uploadName(frame.bytes))
  expect(pictureType(frame.bytes)).toBe('image/png')
  const graph = lastGraph(stand)
  const size = runSize(graph)
  expect(size.width / size.height).not.toBe(200 / 199)
  expect(pngSize(frame.bytes)).toEqual(size)
  expect(JSON.stringify(graph['15'])).toContain(frame.name)
  finishWithVideo(stand, id, H3_TEXT_OUTPUT)
  await expect(screens.runRow(page)).toContainText('Done', { timeout: 15_000 })
  await screens.clipHasMetadata(page, 15_000)
})

// N-6: a reference is not fitted. Ruling F-9: it is sent as a clean PNG of the same size.
test('Make a video from a reference picture: the picture is uploaded as a PNG of its own size', async () => {
  await campaignOnStandIn(true)
  const file = path.join(box.root, 'reference.png')
  const bytes = greyPng(96, 64)
  fs.writeFileSync(file, bytes)
  await screens.startFromAddedPicture(app, page, video.REFERENCE_START, file)
  await screens.startVideo(page, 2)
  await screens.confirmLicence(page)
  const id = await nthSentId(stand, 1)
  const sent = uploads(stand)
  expect(sent).toHaveLength(1)
  const [reference] = sent as [Upload]
  expect(reference.name).toBe(uploadName(reference.bytes))
  expect(pictureType(reference.bytes)).toBe('image/png')
  expect(pngSize(reference.bytes)).toEqual({ width: 96, height: 64 })
  expect(JSON.stringify(lastGraph(stand)['15'])).toContain(reference.name)
  finishWithVideo(stand, id, H3_TEXT_OUTPUT)
  await expect(screens.runRow(page)).toContainText('Done', { timeout: 15_000 })
  await screens.clipHasMetadata(page, 15_000)
})
