// R2C-7 (spec/phases/round-2-campaign.md, design addition 5, "The import dialog"). 364: the
// import dialog with "New subject…" chosen and a name typed. 365: its result, with "Show in
// assets" beside "Done"; then the panel it opens. The native picker is answered through the
// e2e helper. Made-up names only; nothing is paid.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

const PHOTOS = path.resolve('tests/fixtures/briefs/photos')

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

test('the import dialog makes a new subject and offers "Show in assets"', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { app, box, page } = session
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await screens.createProject(page, 'Tidewater Coffee')
  const files = [
    ['citrus-can.png', 'harbour-blend-tin.png'],
    ['berry-bottle.png', 'harbour-blend-cup.png'],
  ].map(([from, name]) => {
    const to = path.join(box.root, name!)
    fs.copyFileSync(path.join(PHOTOS, from!), to)
    return to
  })

  await screens.answerOpenDialog(app, files)
  await page.getByRole('button', { name: 'Import files…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Import 2 file(s)' })
  await dialog.getByRole('combobox', { name: 'Attach to a subject' }).selectOption('New subject…')
  const name = dialog.getByRole('textbox', { name: 'Subject name' })
  await expect(name).toBeFocused()
  await name.fill('Harbour Blend')
  await shot(page, '364-import-new-subject')

  await dialog.getByRole('button', { name: 'Import' }).click()
  await expect(dialog.getByText('2 file(s) added.')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Show in assets' })).toBeVisible()
  await shot(page, '365-import-done-show-in-assets')

  await dialog.getByRole('button', { name: 'Show in assets' }).click()
  const panel = page.getByRole('region', { name: 'Assets' })
  await expect(panel.getByRole('article', { name: 'Harbour Blend' })).toBeVisible()
  await expect(panel).toBeFocused()
})
