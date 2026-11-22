// P7-18: opens a video variant in the editor, for the timeline spec and its shots. No screen
// makes a video variant yet (variant.setFormat is built by P7-10), so the project is made
// through the screens, closed, its master variant changed to video in the closed file, and
// opened again. Not a test file itself.
import { expect, type ElectronApplication, type Page } from '@playwright/test'
import Database from 'better-sqlite3'
import * as screens from './screens'
import { firstIds } from './held-run'

export const VIDEO_MS = 8000

function makeVideo(filePath: string, variantId: string, durationMs: number): void {
  const db = new Database(filePath)
  try {
    db.prepare("UPDATE variant SET format = 'video', duration_ms = ? WHERE id = ?").run(
      durationMs,
      variantId,
    )
  } finally {
    db.close()
  }
}

export async function openVideoEditor(
  app: ElectronApplication,
  page: Page,
  name: string,
): Promise<void> {
  await screens.createProject(page, name)
  await screens.loadBriefAndCreate(app, page)
  const ids = await firstIds(page)
  const close = page.getByRole('button', { name: `Close ${name}` })
  await close.click()
  await expect(close).toHaveCount(0)
  makeVideo(ids.filePath, ids.variantId, VIDEO_MS)
  await page.getByRole('button', { name: new RegExp(`^Open ${name}`) }).click()
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
  await screens.openCampaign(page)
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().click()
  await expect(page.getByRole('region', { name: 'Timeline' })).toBeVisible()
}

export const timeline = (page: Page) => page.getByRole('region', { name: 'Timeline' })
export const ruler = (page: Page) => timeline(page).getByRole('slider', { name: 'Time' })

export async function rulerTime(page: Page): Promise<number> {
  return Number(await ruler(page).getAttribute('aria-valuenow'))
}

// Presses the ruler at `from` (a share of its width) and drags to `to`, then lets go.
export async function dragRuler(page: Page, from: number, to: number): Promise<void> {
  const box = (await ruler(page).boundingBox())!
  const y = box.y + box.height / 2
  await page.mouse.move(box.x + box.width * from, y)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * ((from + to) / 2), y, { steps: 4 })
  await page.mouse.move(box.x + box.width * to, y, { steps: 4 })
  await page.mouse.up()
}
