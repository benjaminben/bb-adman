// ST-4: the dialog frame's three bands. The key dialog (185) opens when a Gemini run needs a
// key; the Gemini stand-in is installed so no request could leave the computer, and Cancel
// sends nothing. The import dialog (186) shows the base names of the paths it was given; the
// paths are made-up names in the sandbox and nothing is imported.
import { test, expect } from '@playwright/test'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { installGemini } from './p4-14-gemini'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

test('The key dialog in the frame look', async () => {
  session = await openApp()
  const { app, page } = session
  await installGemini(app)
  await screens.createProject(page, 'Summer Launch')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  await screens.chooseSlot(page)
  await screens.setPrompt(page, screens.E2E_PROMPT)
  await screens.setCount(page, 1)
  await screens.chooseProvider(page, 'Google Gemini')
  await screens.generate(page)
  await screens.picturePanel(page).getByRole('button', { name: 'Confirm' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add your Google Gemini key' })
  await expect(dialog.getByLabel('API key')).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '185-key-dialog')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
})

test('The import dialog in the frame look', async () => {
  session = await openApp()
  const { app, page, box } = session
  await screens.createProject(page, 'Summer Launch')
  const names = ['citrus-can-front.png', 'citrus-can-side.png', 'berry-bottle-hero.png']
  await screens.answerOpenDialog(
    app,
    names.map((name) => path.join(box.root, 'Shoot', name)),
  )
  await page.getByRole('button', { name: 'Import files…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Import 3 file(s)' })
  await expect(dialog.getByRole('radio').first()).toBeFocused()
  await page.waitForTimeout(300)
  await shot(page, '186-import-dialog')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
})
