// P7-20 (spec/phases/phase-07-slices-2.md): the clip track in the built app. tiny.mp4 and a
// made-up still come in through "Add clip…" and "Import…"; the still moves, both trim, a drag
// past the still's middle reorders the track, Delete takes a clip off and Undo brings it back.
import { test, expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'
import { answerOpenDialog } from './screens'
import { VIDEO_MS, openVideoEditor, timeline } from './timeline-seed'

const TINY = path.resolve('tests/fixtures/video/tiny.mp4')
const STILL = path.resolve('tests/fixtures/briefs/photos/berry-bottle.png')

let box: Sandbox
let app: ElectronApplication | undefined
test.beforeEach(() => {
  box = makeSandbox()
})
test.afterEach(async () => {
  await app?.close()
  app = undefined
  fs.rmSync(box.root, { recursive: true, force: true })
})

const clips = (page: Page) => timeline(page).getByRole('list', { name: 'Clips' })
const block = (page: Page, name: string) => clips(page).getByRole('button', { name })
const end = (page: Page, clip: string) =>
  clips(page).getByRole('slider', { name: `End of ${clip}` })
const start = (page: Page, clip: string) =>
  clips(page).getByRole('slider', { name: `Start of ${clip}` })
const valueOf = async (slider: Locator) => Number(await slider.getAttribute('aria-valuenow'))

async function importAndAdd(app: ElectronApplication, page: Page, file: string) {
  await answerOpenDialog(app, [file])
  await timeline(page).getByRole('button', { name: 'Add clip…' }).click()
  await timeline(page).getByRole('button', { name: 'Import…' }).click()
  const list = timeline(page).getByRole('list', { name: 'Pictures and videos' })
  await list.getByRole('button', { name: path.basename(file) }).click()
}

async function dragCentreTo(page: Page, from: Locator, to: Locator) {
  const a = (await from.boundingBox())!
  const b = (await to.boundingBox())!
  const y = a.y + a.height / 2
  await page.mouse.move(a.x + a.width / 2, y)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2 + b.width / 8, y, { steps: 8 })
  await page.mouse.up()
}

test('clips are added, moved, trimmed, reordered, removed and brought back by undo', async () => {
  app = await launch(box)
  const page = await app.firstWindow()
  await openVideoEditor(app, page, 'Clip Track Check')
  await expect(clips(page).getByRole('button')).toHaveCount(0)

  await importAndAdd(app, page, TINY)
  await expect(block(page, 'Clip 1: tiny.mp4')).toBeVisible()
  expect(await valueOf(start(page, 'Clip 1: tiny.mp4'))).toBe(0)
  const tinyEnd = await valueOf(end(page, 'Clip 1: tiny.mp4'))
  expect(tinyEnd).toBeGreaterThanOrEqual(100)

  // The still goes to the first free place and runs to the variant's end.
  await importAndAdd(app, page, STILL)
  const still = 'Clip 2: berry-bottle.png'
  await expect(block(page, still)).toBeVisible()
  expect(await valueOf(start(page, still))).toBe(tinyEnd)
  expect(await valueOf(end(page, still))).toBe(VIDEO_MS)

  // Move: 1 s right with Shift leaves a gap; trim: the still's end 1 s back, tiny's 100 ms.
  await block(page, still).focus()
  await page.keyboard.press('Shift+ArrowRight')
  await expect.poll(() => valueOf(start(page, still))).toBe(tinyEnd + 1000)
  await end(page, still).focus()
  await page.keyboard.press('Shift+ArrowLeft')
  await expect.poll(() => valueOf(end(page, still))).toBe(VIDEO_MS)
  await end(page, 'Clip 1: tiny.mp4').focus()
  await page.keyboard.press('ArrowLeft')
  await expect.poll(() => valueOf(end(page, 'Clip 1: tiny.mp4'))).toBe(tinyEnd - 100)

  // Reorder: tiny dragged past the still's middle; the track closes up from 0 in the new order.
  await dragCentreTo(page, block(page, 'Clip 1: tiny.mp4'), block(page, still))
  await expect(block(page, 'Clip 1: berry-bottle.png')).toBeVisible()
  await expect(block(page, 'Clip 2: tiny.mp4')).toBeVisible()
  expect(await valueOf(start(page, 'Clip 1: berry-bottle.png'))).toBe(0)

  // Remove with Delete, then Undo brings it back.
  await block(page, 'Clip 2: tiny.mp4').focus()
  await page.keyboard.press('Delete')
  await expect(clips(page).getByRole('button')).toHaveCount(1)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(block(page, 'Clip 2: tiny.mp4')).toBeVisible()
})
