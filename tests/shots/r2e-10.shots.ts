// R2E-10: the first-run setup over the start screen (welcome, AI keys, ComfyUI server) and the
// Setup card that opens it again from Settings. The mark is cleared before a reload, so the
// setup opens by itself as for a new user. Reduce motion and a fixed Math.random hold the
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

test('The first-run setup and the Setup card', async () => {
  session = await openApp()
  const { page } = session
  await command(page, 'settings.update', { setup: { done: false } })
  await stillPicture(page)
  await pictureDrawn(page)
  const setup = page.getByRole('dialog', { name: 'Set up AdManager' })
  await expect(setup.getByRole('heading', { name: 'Welcome' })).toBeVisible()
  await shot(page, '334-first-run-welcome')

  await setup.getByRole('button', { name: 'Start' }).click()
  await expect(setup.getByRole('heading', { name: 'Step 1 of 3: AI keys' })).toBeFocused()
  await shot(page, '335-first-run-ai-keys')

  await setup.getByRole('button', { name: 'Next' }).click()
  await expect(setup.getByRole('heading', { name: 'Step 2 of 3: ComfyUI server' })).toBeFocused()
  await expect(setup.getByText('No address saved.')).toBeVisible()
  await shot(page, '336-first-run-comfyui')

  await setup.getByRole('button', { name: 'Skip for now' }).click()
  await expect(setup).toBeHidden()
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Setup', level: 2 })).toBeVisible()
  await shot(page, '337-settings-setup-card')
})
