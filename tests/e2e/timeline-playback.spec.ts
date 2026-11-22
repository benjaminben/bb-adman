// P7-18 (spec/phases/phase-07-slices-2.md): a video variant's editor has the timeline; Play
// moves the playhead, Pause stops it, and a drag on the ruler sets the time.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import { makeSandbox, launch, type Sandbox } from './launch'
import { VIDEO_MS, dragRuler, openVideoEditor, ruler, rulerTime, timeline } from './timeline-seed'

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

async function open(): Promise<Page> {
  app = await launch(box)
  const page = await app.firstWindow()
  await openVideoEditor(app, page, 'Timeline Check')
  return page
}

const playheadLeft = (page: Page) =>
  timeline(page)
    .locator('[data-playhead]')
    .evaluate((el) => (el as HTMLElement).style.left)

test('play moves the playhead, pause stops it, and a drag on the ruler sets the time', async () => {
  const page = await open()
  await expect(timeline(page).getByText('0:00.0 / 0:08.0')).toBeVisible()
  expect(await playheadLeft(page)).toBe('0%')

  await timeline(page).getByRole('button', { name: 'Play' }).click()
  await expect(timeline(page).getByRole('button', { name: 'Pause' })).toBeVisible()
  await expect.poll(() => rulerTime(page)).toBeGreaterThan(300)
  expect(await playheadLeft(page)).not.toBe('0%')

  await timeline(page).getByRole('button', { name: 'Pause' }).click()
  await expect(timeline(page).getByRole('button', { name: 'Play' })).toBeVisible()
  const held = await rulerTime(page)
  await page.waitForTimeout(400)
  expect(await rulerTime(page)).toBe(held)

  await dragRuler(page, 0.1, 0.5)
  const middle = await rulerTime(page)
  expect(Math.abs(middle - VIDEO_MS / 2)).toBeLessThanOrEqual(VIDEO_MS / 50)
  await expect(ruler(page)).toBeFocused()
})

test('playing runs to the end and stops there', async () => {
  const page = await open()
  await dragRuler(page, 0.9, 0.95)
  await timeline(page).getByRole('button', { name: 'Play' }).click()
  await expect(timeline(page).getByRole('button', { name: 'Play' })).toBeVisible({
    timeout: 10_000,
  })
  expect(await rulerTime(page)).toBe(VIDEO_MS)
  await expect(timeline(page).getByText('0:08.0 / 0:08.0')).toBeVisible()
})
