// R2P-10 (spec/phases/round-2-platform.md, D9 window side): the project switcher with two
// projects open, its menu with "Open another project…", and the start screen with the project
// open now first in "Recent". Reduce motion and a fixed Math.random hold the start picture
// still, as tests/shots/start-1.shots.ts does.
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
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

async function pictureDrawn(page: Page): Promise<void> {
  const img = page.getByTestId('start-images').locator('img')
  await expect(img).toHaveCount(1)
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0)
}

test('Two projects in the window: the switcher, its menu, and the start screen', async () => {
  session = await openApp()
  const { page } = session
  await stillPicture(page)
  await screens.createProject(page, 'Alpine Spring')
  await screens.createProject(page, 'Harbour Lights')
  const switcher = page.getByRole('button', { name: 'Harbour Lights · 2 open' })
  await expect(switcher).toBeVisible()
  await shot(page, '376-switcher-two-open')

  await switcher.click()
  await expect(page.getByRole('menuitem', { name: 'Open another project…' })).toBeVisible()
  await shot(page, '377-switcher-menu')

  await page.getByRole('menuitem', { name: 'Alpine Spring' }).click()
  await page.getByRole('button', { name: 'Alpine Spring · 2 open' }).click()
  await page.getByRole('menuitem', { name: 'Close project' }).click()
  await expect(page.getByRole('heading', { name: 'Recent' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Show Harbour Lights, open now' })).toBeVisible()
  await pictureDrawn(page)
  await shot(page, '378-start-open-now-first')
})
