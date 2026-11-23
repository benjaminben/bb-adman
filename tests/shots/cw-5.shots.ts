// CW-5 (spec/phases/custom-workflows-slices.md, "CW-5"): 526 the run dialog for pictures with
// the Workflow select (one workflow added by an agent), 527 the run dialog for a video from a
// first frame with its select. Four made-up custom workflows are stored files written into the
// sandbox's userData before the app starts. No address is saved and nothing is sent: each
// dialog is cancelled. 528 (the retry line) has no screen: a ComfyUI retry is sent at once,
// without the run dialog, so it is not taken here.
import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { greyPng } from '@/main/providers/fake/png'
import { makeSandbox, launch } from '../e2e/launch'
import * as screens from '../e2e/screens'
import { reopenAsVideo } from '../e2e/timeline-seed'
import { FIRST_FRAME_START } from '../e2e/video-screens'
import { closeApp, shot, type Session } from './shot'

const FIXTURES = path.resolve('tests/fixtures/comfy-custom')
const graph = (name: string) => JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8'))

const PICTURE_SIZE = { multiple: 16, minPixels: 838_861, maxPixels: 1_048_576 }
const VIDEO_SIZE = { multiple: 32, minPixels: 327_680, maxPixels: 409_600 }
const VIDEO = { fps: 16, maxMs: 8_000, frameStep: 4, frameOffset: 1 }

const STORED = [
  ['custom-0a1b2c3d4e5f', 'Studio portrait', 'user', 'picture.json', null],
  ['custom-1a2b3c4d5e6f', 'Night market poster', 'agent', 'picture.json', null],
  ['custom-2a3b4c5d6e7f', 'Harbour from a first frame', 'user', 'video-first-frame.json', VIDEO],
  ['custom-3a4b5c6d7e8f', 'Slow pan from a still', 'agent', 'video-first-frame.json', VIDEO],
] as const

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

async function open(): Promise<Session> {
  const box = makeSandbox()
  const dir = path.join(box.userData, 'comfy-workflows')
  fs.mkdirSync(dir)
  STORED.forEach(([id, name, addedBy, file, video], i) => {
    const stored = {
      format: 1,
      id,
      name,
      addedBy,
      addedAt: `2026-11-2${i}T09:30:00.000Z`,
      size: video ? VIDEO_SIZE : PICTURE_SIZE,
      video,
      graph: graph(file),
    }
    fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(stored))
  })
  const app = await launch(box)
  const page = await app.firstWindow()
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  session = { box, app, page }
  return session
}

const workflow = (page: Page) =>
  page.getByRole('dialog').getByRole('combobox', { name: 'Workflow' })

test('526 the run dialog for pictures with the Workflow select', async () => {
  test.setTimeout(180_000)
  const { app, page } = await open()
  await screens.createProject(page, 'Night Market')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  await screens.chooseSlot(page)
  await screens.untickReferences(page)
  await screens.setPrompt(page, 'Paper lanterns over a busy night market, warm light')
  await screens.chooseProvider(page, 'ComfyUI')
  const run = await screens.openRunDialog(page)
  await expect(workflow(page)).toBeVisible()
  await workflow(page).selectOption({ label: 'Night market poster (added by an agent)' })
  await expect(run.getByText(/with the workflow Night market poster\./)).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '526-run-dialog-workflow-pictures')
  await run.getByRole('button', { name: 'Cancel' }).click()
  await expect(run).toBeHidden()
})

test('527 the run dialog for a video from a first frame with the Workflow select', async () => {
  test.setTimeout(180_000)
  const { app, page, box } = await open()
  await screens.createProject(page, 'Harbour')
  await screens.loadBriefAndCreate(app, page)
  await reopenAsVideo(page, 'Harbour')
  await screens.openCampaign(page)
  await screens.chooseSlot(page)
  const file = path.join(box.root, 'harbour-still.png')
  fs.writeFileSync(file, greyPng(200, 200))
  await screens.startFromAddedPicture(app, page, FIRST_FRAME_START, file)
  const panel = page.getByRole('region', { name: 'Generate' })
  await panel.getByRole('textbox', { name: 'Prompt' }).fill('Boats rock gently at the quay')
  await panel.getByLabel('Clip length (seconds)').fill('4')
  await panel.getByRole('button', { name: 'Generate…' }).click()
  const run = page.getByRole('dialog', { name: 'Make a video' })
  await run.getByRole('radio', { name: /^ComfyUI/ }).check()
  await workflow(page).selectOption({ label: 'Harbour from a first frame' })
  await expect(run.getByText(/with the workflow Harbour from a first frame\./)).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '527-run-dialog-workflow-video')
  await run.getByRole('button', { name: 'Cancel' }).click()
  await expect(run).toBeHidden()
})
