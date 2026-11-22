// START-2 (spec/phases/design-wave-screens-a.md, "START-2 — The rest of the start screen"): 444 the
// start screen with no top bar and three recent projects, one of them open; 445 the New project
// row. Reduce motion holds one picture and a fixed Math.random picks the same one every run.
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

async function stillPage(page: Page): Promise<void> {
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

test('The start screen with three recent projects, then the New project row', async () => {
  test.setTimeout(120_000)
  session = await openApp()
  const { page } = session
  await stillPage(page)
  for (const name of ['Alpine Spring', 'Harbour Lights']) {
    await screens.createProject(page, name)
    await screens.closeProject(page, name)
  }
  await screens.createProject(page, 'Coastal Autumn')
  await screens.showStart(page)
  await expect(page.getByRole('button', { name: 'Show Coastal Autumn, open now' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Open Harbour Lights/ })).toBeVisible()
  await expect(page.getByRole('banner')).toHaveCount(0)
  await pictureDrawn(page)
  await page.mouse.move(0, 0)
  await page.waitForTimeout(300)
  await shot(page, '444-start-screen')

  await screens.openNewProject(page)
  await page.getByRole('textbox', { name: 'Project name' }).fill('Winter Lights')
  await page.mouse.move(0, 0)
  await page.waitForTimeout(300)
  await shot(page, '445-start-new-project-row')
})
