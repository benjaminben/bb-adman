// SET-7 (spec/phases/design-wave-screens-a.md, "SET-7 — First-run setup"): 420 the welcome step;
// 421 step 3, storage. The mark is cleared before a reload, so the setup opens by itself as for
// a new user. Nothing is typed into any field. Reduce motion and a fixed Math.random hold the
// start screen's picture still, as start-1.shots.ts does.
import { test, expect, type Page } from '@playwright/test'
import { command } from '../e2e/render-helpers'
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

test('The first-run setup: welcome, then the storage step', async () => {
  session = await openApp()
  const { page } = session
  await command(page, 'settings.update', { setup: { done: false } })
  await stillPicture(page)
  await pictureDrawn(page)
  const setup = page.getByRole('dialog', { name: 'Set up AdManager' })
  await expect(setup.getByRole('list', { name: 'Steps' })).toBeVisible()
  await page.mouse.move(0, 0)
  await shot(page, '420-first-run-welcome')

  await setup.getByRole('button', { name: 'Start' }).click()
  await setup.getByRole('button', { name: 'Next' }).click()
  await setup.getByRole('button', { name: 'Next' }).click()
  await expect(setup.getByRole('heading', { name: 'Step 3 of 3: Cloud storage' })).toBeFocused()
  await expect(setup.getByRole('group', { name: 'Dropbox' })).toBeVisible()
  await page.mouse.move(0, 0)
  await shot(page, '421-first-run-storage')

  await setup.getByRole('button', { name: 'Skip for now' }).click()
  await expect(setup).toBeHidden()
})
