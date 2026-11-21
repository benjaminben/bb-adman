// P3-16: thumbnails on the screens. A project with one campaign made from the S2-16 brief. The
// campaign overview shows the master's thumbnail in its tile; the project home shows the same
// picture as the campaign row's cover. Each picture waits until the PNG is really drawn.
import { test, expect, type Locator } from '@playwright/test'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

const BRIEF = path.resolve('tests/shots/fixtures/s2-16-brief.yaml')

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

// The render service draws about a second after the last change; allow for a slow machine.
async function drawn(img: Locator) {
  await expect(img).toHaveAttribute('src', /^blob:/, { timeout: 20_000 })
  await expect
    .poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth), { timeout: 10_000 })
    .toBeGreaterThan(0)
}

test('Thumbnails on the screens', async () => {
  session = await openApp()
  const { app, page } = session
  await screens.createProject(page, 'Alpine Spring')
  await screens.answerOpenDialog(app, [BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  await page
    .getByRole('region', { name: 'Brief' })
    .getByRole('button', { name: 'Create campaign' })
    .click()
  const grid = page.getByRole('list', { name: 'Variants' })
  await expect(grid).toBeVisible()
  await drawn(grid.locator('img'))
  await page.waitForTimeout(300)
  await shot(page, '66-campaign-tile-thumbnail')

  await page.getByRole('tab', { name: 'Project' }).click()
  const campaigns = page.getByRole('list', { name: 'Campaigns' })
  await drawn(campaigns.getByRole('img', { name: /^Cover of / }))
  await page.waitForTimeout(300)
  await shot(page, '65-project-home-campaign-cover')
})
