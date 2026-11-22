// P7-24: a video variant made as workflow 5.5 makes it, on the fake provider. 240 to 242: the
// editor at three times: on the drawn still (1 s), on tiny.mp4 (2.5 s), on the fake run's clip
// (3.5 s; the fake's MP4 holds box headers only, no picture, so the canvas draws black). 243: the whole editor with the timeline, a text layer selected with its entrance and
// exit, the playhead in the empty part of the track. The fal run row and the close warning for
// a started fal run are not made: neither exists without a real, paid fal run. Made-up names,
// a drawn picture and the made-up test clip only.
import { test, expect, type Page } from '@playwright/test'
import { dragRuler, rulerTime } from '../e2e/timeline-seed'
import * as s from '../e2e/video-variant-steps'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  try {
    await closeApp(session)
  } finally {
    session = undefined
  }
})

// Drags the ruler to `ms` of the 8 s post, then waits for the canvas to settle.
async function scrubTo(page: Page, ms: number): Promise<void> {
  await dragRuler(page, 0.02, ms / 8000)
  await expect.poll(() => rulerTime(page)).toBeGreaterThan(ms - 200)
  await page.waitForTimeout(600)
}

test('a video variant at three times, and the whole editor with the timeline', async () => {
  session = await openApp()
  const { app, page, box } = session
  await s.videoWithBackdrop(app, page, 'Dune Light', box.root)
  const stillEnd = await s.valueOf(s.clipEnd(page, 1))
  await s.clipEnd(page, 1).focus()
  for (let at = stillEnd; at > 2000; at -= 1000) await page.keyboard.press('Shift+ArrowLeft')
  await expect.poll(() => s.valueOf(s.clipEnd(page, 1))).toBe(2000)
  await s.importAndAdd(app, page, s.TINY)
  await expect(s.clipBlocks(page)).toHaveCount(2)
  await s.startFromBackground(page)
  await s.backToEditor(page)
  await expect(s.clipBlocks(page)).toHaveCount(3, { timeout: 30_000 })

  await scrubTo(page, 1000)
  await shot(page, '240-video-variant-on-still')
  await scrubTo(page, 2500)
  await shot(page, '241-video-variant-on-clip')
  await scrubTo(page, 3500)
  await shot(page, '242-video-variant-on-run-clip')

  await s.selectTextLayer(page)
  await page.getByRole('combobox', { name: 'Entrance' }).selectOption({ label: 'Fade up' })
  await page.getByRole('combobox', { name: 'Exit' }).selectOption({ label: 'Fade' })
  await scrubTo(page, 6000)
  await shot(page, '243-video-editor-timeline')
})
