// P6-17: workflow 5.2 through the screens, with the fake as the text provider (set in Settings;
// no paid call, nothing leaves the computer). 215: the grid after fan-out to two more sizes and
// de and ja. 216: a ja post in the editor with its translation status. 217: the checks across
// the grid with warnings (the brief's required words on the English posts, a prohibited "!" on
// one German post). 218: the translation sheet saved. 219: every translation approved.
// The save dialog is answered in the main process, as p6-13.shots.ts does. Made-up names only.
import { test, expect } from '@playwright/test'
import path from 'node:path'
import * as l from '../e2e/localize-steps'
import * as v from '../e2e/variants-steps'
import { closeApp, openApp, shot, type Session } from './shot'

const SHEET = 'lantern-bay-translations.csv'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

test('Workflow 5.2: the grid, a ja post, checks, the sheet, all approved', async () => {
  test.setTimeout(240_000)
  session = await openApp()
  const { app, page, box } = session
  await l.localise(app, page, 'Lantern Bay')
  await v.grid(page, l.DIRECTION).scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await shot(page, '215-localise-grid-after-fan-out')

  await v.editLayer(page, v.tile(page, l.DIRECTION, '1080×1080 · ja'), 'Headline')
  await expect(page.getByText('Translation: Proposed, from AI')).toBeVisible()
  await page.waitForTimeout(500)
  await shot(page, '216-localise-ja-in-editor')
  await v.showOverview(page)

  await l.typeFirst(page, 'German', 'Kühl bleiben, Schluck für Schluck!')
  await l.setWords(page, 'Prohibited words', 'de', '!')
  await l.runChecks(page, 4)
  await expect(v.grid(page, l.DIRECTION).getByText('Check warning')).toHaveCount(4)
  await l.checks(page).scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await shot(page, '217-localise-checks-with-warnings')

  await l.answerSaveDialog(app, path.join(box.root, SHEET))
  await l.exportSheet(page, SHEET)
  await l.translations(page).scrollIntoViewIfNeeded()
  await shot(page, '218-localise-sheet-saved')

  const german = await l.rows(page, 'German').count()
  const japanese = await l.rows(page, 'Japanese').count()
  await l.approveAll(page, 'German', german)
  await l.approveAll(page, 'Japanese', japanese)
  await expect(v.grid(page, l.DIRECTION).getByText('Translation not approved')).toHaveCount(0)
  await l.translations(page).scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await shot(page, '219-localise-all-approved')
})
