// AST-2 (spec/phases/design-wave-screens-b.md, "AST-2"): 458, two subject cards in the Assets
// panel, one with two photos and one without (the "+" tile with the warn edge). Made-up names
// and drawn pictures only; nothing is paid.
import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { command, query } from '../e2e/render-helpers'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

const PHOTOS = path.resolve('tests/fixtures/briefs/photos')

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

const panel = (page: Page) => page.getByRole('region', { name: 'Assets' })

async function fillProject(page: Page, folder: string, projectId: string) {
  const paths = ['citrus-can.png', 'berry-bottle.png'].map((name) => {
    const to = path.join(folder, `tin-${name}`)
    fs.copyFileSync(path.join(PHOTOS, name), to)
    return to
  })
  await command(page, 'subject.create', {
    projectId,
    id: 'Harbour-Blend',
    name: 'Harbour Blend',
    description: 'A dark roast in a blue tin.',
  })
  await command(page, 'subject.create', {
    projectId,
    id: 'Tidewater-Mug',
    name: 'Tidewater Mug',
    description: 'The enamel mug sold at the counter.',
  })
  await command(page, 'asset.import', {
    projectId,
    paths,
    library: 'asset',
    copy: false,
    subjectId: 'Harbour-Blend',
  })
}

test('subject cards: one with photos, one without', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { box, page } = session
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await screens.createProject(page, 'Tidewater Coffee')
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  await fillProject(page, box.root, state.openProjects[0]!.projectId)

  await page.getByRole('button', { name: 'Open assets' }).click()
  const blend = panel(page).getByRole('article', { name: 'Harbour Blend' })
  await expect(blend.getByRole('list', { name: 'Photos of Harbour Blend' })).toBeVisible()
  await expect(blend.locator('img')).toHaveCount(2)
  await expect(
    panel(page).getByRole('button', { name: 'Add photos to Tidewater Mug' }),
  ).toBeVisible()
  await page.mouse.move(800, 900)
  await page.waitForTimeout(500)
  await shot(page, '458-subject-cards')
})
