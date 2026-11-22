// ED-6 (spec/phases/design-wave-screens-a.md, "Timeline small flaws"). 435: a video post with
// two clips (a drawn still and the made-up test clip), the video clip chosen so its small bar
// shows "Sound for tiny.mp4" and "Remove tiny.mp4" over its block, and a text layer's Animation
// open with its In and Out rows. Nothing is generated. Made-up names and a drawn picture only.
import { test, expect, type Page } from '@playwright/test'
import { timeline } from '../e2e/timeline-seed'
import * as s from '../e2e/video-variant-steps'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

const animation = (page: Page) => page.getByRole('button', { name: 'Animation' })

// The first layer whose panel has the Animation Section: a text layer. Gives its name.
async function selectTextLayer(page: Page): Promise<string> {
  const tracks = timeline(page).getByRole('list', { name: 'Layer tracks' })
  const bars = tracks.getByRole('button', { name: /^Timing of / })
  await expect(bars.first()).toBeVisible()
  for (const label of await bars.evaluateAll((els) => els.map((e) => e.ariaLabel ?? ''))) {
    const name = label.replace(/^Timing of /, '')
    await s.selectLayer(page, name)
    if ((await animation(page).count()) > 0) return name
  }
  throw new Error('The ad has no text layer.')
}

test('435 a chosen clip with its bar, and Animation open on a text layer', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { app, page, box } = session
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await s.videoWithBackdrop(app, page, 'Dune Light', box.root)
  const stillEnd = await s.valueOf(s.clipEnd(page, 1))
  await s.clipEnd(page, 1).focus()
  for (let at = stillEnd; at > 2000; at -= 1000) await page.keyboard.press('Shift+ArrowLeft')
  await expect.poll(() => s.valueOf(s.clipEnd(page, 1))).toBe(2000)
  await s.importAndAdd(app, page, s.TINY)
  await expect(s.clipBlocks(page)).toHaveCount(2)

  await selectTextLayer(page)
  if ((await animation(page).getAttribute('aria-expanded')) === 'false') {
    await animation(page).click()
  }
  await page.getByRole('combobox', { name: 'Entrance' }).selectOption({ label: 'Fade up' })
  await page.getByRole('combobox', { name: 'Exit' }).selectOption({ label: 'Fade' })

  await s.clipBlock(page, 2).focus()
  await expect(s.clips(page).getByRole('group', { name: 'tiny.mp4' })).toBeVisible()
  await page.mouse.move(10, 10)
  await page.waitForTimeout(400)
  await shot(page, '435-timeline-clip-bar-animation')
})
