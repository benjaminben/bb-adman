// SPEC 14 1.56 E2E-R, the offline spec: the built app driven through its screens against the
// stand-in ComfyUI on 127.0.0.1, with the hand-test tools on so trial workflows are offered.
// No real server, no paid provider and no network beyond 127.0.0.1 is reached: Gemini is
// answered inside the app's main process by gemini-stand-in.ts. TP-6's video start is here,
// and CU-6b-R's video from a picture (1.60 N-11); the rows that need no stand-in are in
// screen-tour.spec.ts (1.59 L-12).
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
} from './stand-in-runs'
import * as screens from './screens'
import * as video from './video-screens'
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

// The project, the campaign from the test brief, and the stand-in's address saved.
async function campaignOnStandIn(): Promise<void> {
  const comfy = await screens.openSettings(page)
  await screens.saveAddress(comfy, stand.origin)
  await screens.createProject(page, 'Stand-in')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  await screens.chooseProvider(page, 'ComfyUI')
  await screens.chooseSlot(page)
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
  await expect(comfy.getByText('No address saved.')).toBeVisible()
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
  await expect(comfy.getByText('No address saved.')).toBeVisible()
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
  const picture = screens.runRow(page).getByRole('img', { name: 'Result 1' })
  await expect(picture).toBeVisible()
  expect(await picture.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)

  await generate()
  finishWithError(stand, await nthSentId(stand, 2))
  await expect(screens.runRow(page)).toContainText('Failed', { timeout: 15_000 })
  await screens.runRow(page).getByRole('button', { name: 'Retry' }).click()
  finishWithPicture(stand, await nthSentId(stand, 3), MOSS_OUTPUT)
  await expect(screens.runRow(page)).toContainText('Done', { timeout: 15_000 })

  await generate()
  await nthSentId(stand, 4)
  await expect(screens.runRow(page)).toContainText(screens.WAITING_ON_SERVER)
  await screens.runRow(page).getByRole('button', { name: 'Cancel' }).click()
  await expect(screens.runRow(page)).toContainText('Cancelled', { timeout: 15_000 })
})

test("References and the paid confirm: an added picture goes to Flux; Gemini's confirm is cancelled", async () => {
  await campaignOnStandIn()
  const file = path.join(box.root, 'reference.png')
  fs.writeFileSync(file, greyPng(32, 24))

  await screens.answerOpenDialog(app, [file])
  const references = page.getByRole('region', { name: 'Reference pictures' })
  await references.getByRole('button', { name: 'Add pictures' }).click()
  const tick = references.getByRole('checkbox')
  await expect(tick).toHaveCount(1)
  await tick.check()
  await generate()
  finishWithPicture(stand, await nthSentId(stand, 1), FLUX_OUTPUT)
  await expect(screens.runRow(page)).toContainText('Done', { timeout: 15_000 })
  expect(stand.seen.some((r) => r.method === 'POST' && r.path === '/upload/image')).toBe(true)

  await screens.chooseProvider(page, 'Google Gemini')
  await generate()
  const panel = screens.picturePanel(page)
  await expect(panel.getByText(/^This sends 1 paid request\(s\)/)).toBeVisible()
  await panel.getByRole('button', { name: 'Cancel' }).click()
  await expect(panel.getByRole('button', { name: 'Generate' })).toBeVisible()
  await expect(screens.runRows(page)).toHaveCount(1)
})

test('Key dialog and paid Retry: Cancel, then a made-up key saved; the refused run is retried', async () => {
  await campaignOnStandIn()
  await standInForGemini(app)
  await screens.chooseProvider(page, 'Google Gemini')
  const panel = screens.picturePanel(page)
  const dialog = page.getByRole('dialog', { name: 'Add your Google Gemini key' })

  await generate()
  await expect(panel.getByText(/^This sends 1 paid request\(s\)/)).toBeVisible()
  await panel.getByRole('button', { name: 'Confirm' }).click()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
  await expect(screens.runRows(page)).toHaveCount(0)
  expect(await geminiAsked(app)).toEqual([])

  await generate()
  await panel.getByRole('button', { name: 'Confirm' }).click()
  await dialog.getByLabel('API key').fill(MADE_UP_KEY)
  // Re-review S-A: the main process's fetch is the stand-in before the key can be sent.
  expect(await standInInstalled(app)).toBe(true)
  await dialog.getByRole('button', { name: 'Save and continue' }).click()
  await expect(dialog).toBeHidden()
  await expect(screens.runRow(page)).toContainText('Failed', { timeout: 15_000 })
  expect(await geminiAsked(app)).toEqual([GEMINI_ORIGIN])

  const row = screens.runRow(page)
  await row.getByRole('button', { name: 'Retry' }).click()
  await expect(row.getByText(/^This sends 1 paid request\(s\)/)).toBeVisible()
  await row.getByRole('button', { name: 'Cancel' }).click()
  expect(await geminiAsked(app)).toEqual([GEMINI_ORIGIN])
  await row.getByRole('button', { name: 'Retry' }).click()
  await row.getByRole('button', { name: 'Confirm' }).click()
  await expect.poll(() => geminiAsked(app)).toEqual([GEMINI_ORIGIN, GEMINI_ORIGIN])
  await expect(screens.runRow(page)).toContainText('Failed', { timeout: 15_000 })
})

// SPEC 14 1.57 TP-6: the clip's metadata loads in the built app, so its CSP (media-src) and
// the adman-asset:// protocol let a video through.
test('Make a video: a 2-second clip from a prompt is started, done and has its metadata', async () => {
  await campaignOnStandIn()
  await screens.startVideo(page, 2)
  const id = await nthSentId(stand, 1)
  expect(lastSentPrompt()).toContain(screens.E2E_VIDEO_PROMPT)
  await expect(screens.runRow(page)).toContainText('Video')
  finishWithVideo(stand, id, H3_TEXT_OUTPUT)
  await expect(screens.runRow(page)).toContainText('Done', { timeout: 15_000 })
  await screens.clipHasMetadata(page, 15_000)
})

// SPEC 14 1.60 CU-6b-R N-11 and CU-6b-F N-3: a 96 x 64 picture made here is the first frame.
// The built app's fitPicture (Electron's nativeImage) crops and scales it, so the one upload
// is a PNG at the run's size under the app's own name, and the graph names that upload.
test('Make a video from a first-frame picture: the upload is a PNG at the run size', async () => {
  await campaignOnStandIn()
  const file = path.join(box.root, 'first-frame.png')
  fs.writeFileSync(file, greyPng(96, 64))
  await video.choosePictureStart(app, page, video.FIRST_FRAME_START, [file])
  await screens.startVideo(page, 2)
  const id = await nthSentId(stand, 1)
  const sent = uploads(stand)
  expect(sent).toHaveLength(1)
  const [frame] = sent as [Upload]
  expect(frame.name).toBe(uploadName(frame.bytes))
  expect(pictureType(frame.bytes)).toBe('image/png')
  const graph = lastGraph(stand)
  const size = runSize(graph)
  expect(size.width / size.height).not.toBe(96 / 64)
  expect(pngSize(frame.bytes)).toEqual(size)
  expect(JSON.stringify(graph['15'])).toContain(frame.name)
  finishWithVideo(stand, id, H3_TEXT_OUTPUT)
  await expect(screens.runRow(page)).toContainText('Done', { timeout: 15_000 })
  await screens.clipHasMetadata(page, 15_000)
})

// N-6: a reference is sent as read, not fitted.
test('Make a video from a reference picture: the picture is uploaded as read', async () => {
  await campaignOnStandIn()
  const file = path.join(box.root, 'reference.png')
  const bytes = greyPng(96, 64)
  fs.writeFileSync(file, bytes)
  await video.choosePictureStart(app, page, video.REFERENCE_START, [file])
  await screens.startVideo(page, 2)
  const id = await nthSentId(stand, 1)
  const sent = uploads(stand)
  expect(sent).toHaveLength(1)
  const [reference] = sent as [Upload]
  expect(reference.name).toBe(uploadName(reference.bytes))
  expect(Buffer.from(reference.bytes).equals(Buffer.from(bytes))).toBe(true)
  expect(JSON.stringify(lastGraph(stand)['15'])).toContain(reference.name)
  finishWithVideo(stand, id, H3_TEXT_OUTPUT)
  await expect(screens.runRow(page)).toContainText('Done', { timeout: 15_000 })
  await screens.clipHasMetadata(page, 15_000)
})
