// P5-18: the direction menu and its dialogs, from the S2-16 brief. campaign.create makes one
// direction, "Direction 1". 166: "New direction" with its default name. 167: the two grids
// after "Make direction". 168: "Rename Direction 1". 169: the warning before delete. Made-up
// names only; nothing is deleted.
import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

const BRIEF = path.resolve('tests/shots/fixtures/s2-16-brief.yaml')
const CAMPAIGN = 'Alpine Spring Water'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

async function chooseItem(page: Page, direction: string, item: string): Promise<void> {
  const section = page.getByRole('region', { name: direction })
  await section.getByRole('button', { name: 'Direction', exact: true }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

test('The direction menu and its dialogs', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { app, page } = session
  await screens.createProject(page, 'Alpine Spring')
  await screens.answerOpenDialog(app, [BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  await page
    .getByRole('region', { name: 'Brief' })
    .getByRole('button', { name: 'Create campaign' })
    .click()
  await expect(page.getByRole('heading', { name: CAMPAIGN, level: 2 })).toBeVisible()

  await chooseItem(page, 'Direction 1', 'New direction from this master…')
  const make = page.getByRole('dialog', { name: 'New direction' })
  await expect(make.getByRole('textbox', { name: 'Name' })).toHaveValue('Direction 2')
  await make.getByRole('textbox', { name: 'Name' }).fill('Studio')
  await shot(page, '166-new-direction-dialog')

  await make.getByRole('button', { name: 'Make direction' }).click()
  await expect(make).toBeHidden()
  const studio = page.getByRole('region', { name: 'Studio' })
  await expect(studio.getByRole('heading', { name: 'Studio', level: 3 })).toBeVisible()
  await expect(studio.getByText('1 variant(s)')).toBeVisible()
  await expect(page.getByRole('list', { name: /^Variants in / })).toHaveCount(2)
  await shot(page, '167-two-direction-grids')

  await chooseItem(page, 'Direction 1', 'Rename…')
  const rename = page.getByRole('dialog', { name: 'Rename Direction 1' })
  await rename.getByRole('textbox', { name: 'Name' }).fill('Daylight')
  await shot(page, '168-rename-direction')
  await rename.getByRole('button', { name: 'Rename' }).click()
  await expect(page.getByRole('heading', { name: 'Daylight', level: 3 })).toBeVisible()

  await chooseItem(page, 'Studio', 'Delete direction…')
  const remove = page.getByRole('dialog', { name: 'Delete Studio?' })
  await expect(remove).toContainText('Its 1 variant(s) go with it. This cannot be undone.')
  await expect(remove.getByRole('button', { name: 'Keep' })).toBeFocused()
  await shot(page, '169-delete-direction-confirm')
  await remove.getByRole('button', { name: 'Keep' }).click()
  await expect(studio).toBeVisible()
})
