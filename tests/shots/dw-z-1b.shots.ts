// Z-1b, five small fixes. 502: a video post with a short still and the made-up test clip; the
// short clip is chosen and its bar stands fully above its block, its right end at the block's,
// inside the lane, so the name shows. The places are measured as well as pictured. 503: the
// first-run storage step, its words "Cloud storage" seen once. Nothing is generated or typed.
// Made-up names and a drawn picture only.
import { test, expect, type Locator, type Page } from '@playwright/test'
import { command } from '../e2e/render-helpers'
import * as s from '../e2e/video-variant-steps'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

async function stillPicture(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
}

async function boxOf(target: Locator) {
  const box = await target.boundingBox()
  if (box === null) throw new Error('not drawn')
  return box
}

test('502 a short chosen clip with its bar above the block', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { app, page, box } = session
  await stillPicture(page)
  await s.videoWithBackdrop(app, page, 'Dune Light', box.root)
  const stillEnd = await s.valueOf(s.clipEnd(page, 1))
  await s.clipEnd(page, 1).focus()
  for (let at = stillEnd; at > 1000; at -= 1000) await page.keyboard.press('Shift+ArrowLeft')
  await expect.poll(() => s.valueOf(s.clipEnd(page, 1))).toBe(1000)
  await s.importAndAdd(app, page, s.TINY)
  await expect(s.clipBlocks(page)).toHaveCount(2)

  const block = s.clips(page).locator('[data-clip]').nth(0)
  const before = await boxOf(block)
  await s.clipBlock(page, 1).focus()
  const bar = s.clips(page).getByRole('group')
  await expect(bar).toBeVisible()
  const after = await boxOf(block)
  const place = await boxOf(bar)
  const lane = await boxOf(s.clips(page))
  expect(after.width).toBeCloseTo(before.width, 1)
  expect(place.y + place.height).toBeLessThanOrEqual(after.y + 0.5)
  expect(place.x).toBeGreaterThanOrEqual(lane.x - 0.5)
  expect(place.x + place.width).toBeLessThanOrEqual(lane.x + lane.width + 0.5)
  if (place.width <= after.x + after.width - lane.x) {
    expect(place.x + place.width).toBeCloseTo(after.x + after.width, 0)
  }
  await page.mouse.move(10, 10)
  await page.waitForTimeout(400)
  await shot(page, '502-timeline-short-clip-bar-above')
})

test('503 the first-run storage step, its name seen once', async () => {
  session = await openApp()
  const { page } = session
  await command(page, 'settings.update', { setup: { done: false } })
  await stillPicture(page)
  const setup = page.getByRole('dialog', { name: 'Set up AdManager' })
  await setup.getByRole('button', { name: 'Start' }).click()
  await setup.getByRole('button', { name: 'Next' }).click()
  await setup.getByRole('button', { name: 'Next' }).click()
  await expect(setup.getByRole('heading', { name: 'Step 3 of 3: Cloud storage' })).toBeFocused()
  await expect(setup.getByRole('group', { name: 'Dropbox' })).toBeVisible()
  await expect(setup.getByRole('button', { name: 'About this step' })).toBeVisible()
  await page.mouse.move(0, 0)
  await shot(page, '503-first-run-storage')

  await setup.getByRole('button', { name: 'Skip for now' }).click()
  await expect(setup).toBeHidden()
})
