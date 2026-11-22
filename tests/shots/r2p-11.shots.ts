// R2P-11 (spec/phases/round-2-platform.md, D10): the start screen with the app mark and the
// name AdManager, and the committed icon PNG drawn at 1024 px and at 32 px (also shown eight
// times larger, pixel for pixel, so the small size can be judged). Pictures are still, as
// tests/shots/start-1.shots.ts makes them.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
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

async function snap(page: Page, name: string, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height })
  await page.waitForTimeout(200)
  fs.mkdirSync(path.resolve('shots'), { recursive: true })
  await page.screenshot({ path: path.resolve('shots', `${name}.png`) })
}

// Replaces the page with the icon at 1024 px, at 32 px, and the 32 px drawing made larger.
async function drawIcon(page: Page): Promise<void> {
  const png = fs.readFileSync(path.resolve('resources/icon.png')).toString('base64')
  await page.evaluate(async (data) => {
    const icon = new Image()
    icon.src = `data:image/png;base64,${data}`
    await icon.decode()
    document.body.replaceChildren()
    const row = document.createElement('div')
    Object.assign(row.style, { display: 'flex', alignItems: 'end', gap: '48px', padding: '24px' })
    const small = document.createElement('canvas')
    small.width = 32
    small.height = 32
    small.getContext('2d')?.drawImage(icon, 0, 0, 32, 32)
    const large = icon.cloneNode() as HTMLImageElement
    large.width = 1024
    const enlarged = document.createElement('img')
    enlarged.src = small.toDataURL()
    Object.assign(enlarged.style, { width: '256px', imageRendering: 'pixelated' })
    row.append(large, small, enlarged)
    document.body.append(row)
    document.body.style.background = 'var(--color-page)'
  }, png)
}

test('The start screen shows the app mark and AdManager', async () => {
  session = await openApp()
  const { page } = session
  await stillPicture(page)
  await expect(page.getByRole('heading', { name: 'AdManager', level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'AdManager' })).toBeVisible()
  const img = page.getByTestId('start-images').locator('img')
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0)
  await snap(page, '379-start-app-mark', 1280, 820)
})

test('The app icon at 1024 px and at 32 px', async () => {
  session = await openApp()
  const { page } = session
  await drawIcon(page)
  await snap(page, '380-app-icon-1024-and-32', 1500, 1080)
})
