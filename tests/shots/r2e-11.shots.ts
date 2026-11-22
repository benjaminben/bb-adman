// R2E-11: pointing to where videos are made (spec/phases/round-2-editor.md D7). An image post
// with a drawn dune picture becomes a video of 8 s. 339: no layer selected, the properties
// panel says where videos are made. 338: the timeline's "Make a video…" beside "Add clip…";
// pressed, it selects the background with "Video" chosen and the focus on "Prompt". Nothing
// runs and nothing is sent. Reduce motion and a fixed Math.random keep the window still.
import { test, expect } from '@playwright/test'
import * as s from '../e2e/video-variant-steps'
import { timeline } from '../e2e/timeline-seed'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

const EMPTY = 'Select a layer to change it. To make a video, select the background layer.'

test('the timeline and the empty properties panel point to where videos are made', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { app, page, box } = session
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await s.videoWithBackdrop(app, page, 'Dune Light', box.root)
  await s.selectLayer(page, await s.backgroundName(page))
  await page.keyboard.press('Escape')
  const properties = page.getByRole('region', { name: 'Properties' })
  await expect(properties.getByText(EMPTY)).toBeVisible()
  await shot(page, '339-properties-empty-video')

  const make = timeline(page).getByRole('button', { name: 'Make a video…' })
  await expect(make).toBeVisible()
  await make.click()
  const panel = page.getByRole('group', { name: 'Generate' })
  await expect(
    panel.getByRole('group', { name: 'Make' }).getByRole('button', { name: 'Video' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(panel.getByRole('textbox', { name: 'Prompt' })).toBeFocused()
  await shot(page, '338-timeline-make-video')
})
