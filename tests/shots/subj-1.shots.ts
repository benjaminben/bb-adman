// SUBJ-1 (spec/phases/subject-delete.md, "Shots"): 500, the home Assets block with a subject card
// showing its pencil and trash buttons; 501, the delete dialog for a subject with photos.
// Made-up names and drawn pictures only; nothing is paid and nothing is deleted.
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

// D-109: the home page draws the library in its own Assets block, so the cards are there.
const library = (page: Page) => page.getByRole('region', { name: 'Assets' })

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

test('subject delete: the trash button and the dialog', async () => {
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

  const blend = library(page).getByRole('article', { name: 'Harbour Blend' })
  await blend.scrollIntoViewIfNeeded()
  await expect(blend.locator('img')).toHaveCount(2)
  const trash = blend.getByRole('button', { name: 'Delete Harbour Blend' })
  await expect(trash).toBeVisible()
  await page.mouse.move(800, 900)
  await page.waitForTimeout(500)
  await shot(page, '500-subject-card-delete-button')

  await trash.click()
  const dialog = page.getByRole('dialog', { name: 'Delete Harbour Blend?' })
  await expect(dialog.getByRole('button', { name: 'Keep' })).toBeFocused()
  await page.waitForTimeout(500)
  await shot(page, '501-subject-delete-dialog')
  await dialog.getByRole('button', { name: 'Keep' }).click()
  await expect(dialog).toBeHidden()
})
