// P7-24, Phase 7 exit criterion 1: workflow 5.5 (a video variant) end to end in the built app
// with ADMAN_FAKE_PROVIDERS=1. An image post with a background picture is changed to video and
// set to 8 s; the picture is the first clip; tiny.mp4 is imported; a fake run from the post's
// background lands at the first free position while the editor is in use [FR-124]; clips are
// moved and trimmed and a gap draws black; a text layer gets a start, an end, an entrance and
// an exit; play, pause and scrub. No paid call; made-up names and a drawn picture only.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import { makeSandbox, launch, type Sandbox } from './launch'
import { firstIds } from './held-run'
import { renderPng } from './render-helpers'
import { decodePng } from './reference-compare'
import * as screens from './screens'
import { dragRuler, ruler, rulerTime, timeline } from './timeline-seed'
import * as s from './video-variant-steps'

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

const tracks = (page: Page) => timeline(page).getByRole('list', { name: 'Layer tracks' })
const trackSlider = (name: string) => tracks(page).getByRole('slider', { name })

// variant.render at `timeMs`: the colour channels in the top half brighter than near-black.
async function litTopHalfAt(timeMs: number): Promise<number> {
  const { projectId, variantId } = await firstIds(page)
  const png = await renderPng(page, { projectId, variantId, maxDimension: 320, timeMs })
  const drawn = await decodePng(app, png)
  const top = drawn.pixels.subarray(0, drawn.width * Math.floor(drawn.height / 2) * 4)
  return top.filter((v, i) => i % 4 !== 3 && v > 8).length
}

test('Workflow 5.5: a video variant from an image post, its clips, a run and its text', async () => {
  test.setTimeout(180_000)
  // Step 1: the image post with a background picture becomes a video of 8 s.
  await s.videoWithBackdrop(app, page, 'Dune Light', box.root)
  await expect(timeline(page).getByText('0:00.0 / 0:08.0')).toBeVisible()

  // The still is the first clip, made when the format changed, to the length the post had
  // then (6 s); the 8 s set after does not stretch it. Its end is pulled back to 2 s.
  await expect(s.clipBlocks(page)).toHaveCount(1)
  await expect(s.clipBlock(page, 1)).toHaveAccessibleName(`Clip 1: ${s.BACKDROP}`)
  expect(await s.valueOf(s.clipStart(page, 1))).toBe(0)
  const stillEnd = await s.valueOf(s.clipEnd(page, 1))
  expect(stillEnd).toBeGreaterThan(2000)
  await s.clipEnd(page, 1).focus()
  for (let at = stillEnd; at > 2000; at -= 1000) await page.keyboard.press('Shift+ArrowLeft')
  await expect.poll(() => s.valueOf(s.clipEnd(page, 1))).toBe(2000)

  // An imported MP4 goes to the first free position, after the still.
  await s.importAndAdd(app, page, s.TINY)
  await expect(s.clipBlock(page, 2)).toHaveAccessibleName('Clip 2: tiny.mp4')
  expect(await s.valueOf(s.clipStart(page, 2))).toBe(2000)
  const tinyEnd = await s.valueOf(s.clipEnd(page, 2))
  expect(tinyEnd).toBeGreaterThan(2000)
  // A fake run from the post's background. While it works, the editor is used: the text layer
  // gets a later start, an earlier end, an entrance and an exit [FR-124].
  await s.startFromBackground(page)
  await expect(screens.runRow(page)).toContainText('Working')
  await s.backToEditor(page)
  const name = await s.selectTextLayer(page)
  const start = trackSlider(`Start of Timing of ${name}`)
  const end = trackSlider(`End of Timing of ${name}`)
  await start.focus()
  await page.keyboard.press('Shift+ArrowRight')
  await expect.poll(() => s.valueOf(start)).toBe(1000)
  await end.focus()
  await page.keyboard.press('Shift+ArrowLeft')
  await expect.poll(() => s.valueOf(end)).toBe(7000)
  await page.getByRole('combobox', { name: 'Entrance' }).selectOption({ label: 'Fade up' })
  await page.getByRole('combobox', { name: 'Exit' }).selectOption({ label: 'Fade' })
  await expect(trackSlider(`Start of Entrance of ${name}`)).toHaveAttribute('aria-valuenow', '1000')
  await expect(trackSlider(`End of Exit of ${name}`)).toHaveAttribute('aria-valuenow', '7000')

  // The run's clip lands at the first free position, after tiny.mp4.
  await expect(s.clipBlocks(page)).toHaveCount(3, { timeout: 30_000 })
  expect(await s.valueOf(s.clipStart(page, 3))).toBe(tinyEnd)
  // The run's clip is moved 1 s right, leaving a gap after tiny.mp4, and its end trimmed.
  await s.clipBlock(page, 3).focus()
  await page.keyboard.press('Shift+ArrowRight')
  await expect.poll(() => s.valueOf(s.clipStart(page, 3))).toBe(tinyEnd + 1000)
  const runEnd = await s.valueOf(s.clipEnd(page, 3))
  await s.clipEnd(page, 3).focus()
  await page.keyboard.press('ArrowLeft')
  await expect.poll(() => s.valueOf(s.clipEnd(page, 3))).toBe(runEnd - 100)
  // Inside the gap the background is black (the text is drawn over it lower down); on the
  // still it is not.
  expect(await litTopHalfAt(tinyEnd + 500)).toBe(0)
  expect(await litTopHalfAt(1000)).toBeGreaterThan(0)

  // Play moves the playhead, Pause stops it, a drag on the ruler sets the time.
  await timeline(page).getByRole('button', { name: 'Play' }).click()
  await expect.poll(() => rulerTime(page)).toBeGreaterThan(300)
  await timeline(page).getByRole('button', { name: 'Pause' }).click()
  const held = await rulerTime(page)
  await page.waitForTimeout(400)
  expect(await rulerTime(page)).toBe(held)
  await dragRuler(page, 0.1, 0.5)
  expect(Math.abs((await rulerTime(page)) - 4000)).toBeLessThanOrEqual(160)
  await expect(ruler(page)).toBeFocused()
})
