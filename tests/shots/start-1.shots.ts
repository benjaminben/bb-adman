// START-1: the start screen in two halves, the picture on the left and the name, buttons and
// recent project names on the right; at the default window, the smallest window, and with no
// recent projects. Reduce motion holds one picture, and a fixed Math.random picks the same
// one on every run, so the pictures never differ between runs.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import { closeApp, openApp, type Session } from './shot'

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
  await expect(page.getByRole('heading', { name: 'Adman', level: 1 })).toBeVisible()
  const img = page.getByTestId('start-images').locator('img')
  await expect(img).toHaveCount(1)
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0)
}

async function snap(page: Page, name: string, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height })
  await page.waitForTimeout(200)
  fs.mkdirSync(path.resolve('shots'), { recursive: true })
  await page.screenshot({ path: path.resolve('shots', `${name}.png`) })
}

test('The start screen in two halves, with recent projects', async () => {
  session = await openApp()
  const { page } = session
  await stillPicture(page)
  await screens.createProject(page, 'Alpine Spring')
  await screens.createProject(page, 'Harbour Lights')
  await screens.showStart(page)
  await expect(page.getByRole('button', { name: /^Open Alpine Spring/ })).toBeVisible()
  await pictureDrawn(page)
  await snap(page, '360-start-two-halves', 1280, 820)
  await snap(page, '361-start-smallest-window', 900, 600)
})

test('The start screen with no recent projects', async () => {
  session = await openApp()
  const { page } = session
  await stillPicture(page)
  await pictureDrawn(page)
  await expect(page.getByRole('heading', { name: 'Recent' })).toHaveCount(0)
  await snap(page, '362-start-no-recent', 1280, 820)
})
