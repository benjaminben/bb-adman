// ST-3: the app shell in the app style. A project with two campaigns, both open in tabs, the
// second one shown; then the project switcher's menu open over the project home.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

const SECOND_BRIEF = path.resolve('tests/shots/fixtures/s2-16-brief.yaml')
const SECOND_CAMPAIGN = 'Alpine Spring Water'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

async function createFrom(app: ElectronApplication, page: Page, brief: string, name: string) {
  await screens.answerOpenDialog(app, [brief])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  await page
    .getByRole('region', { name: 'Brief' })
    .getByRole('button', { name: 'Create campaign' })
    .click()
  await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible()
}

test('The shell with two campaign tabs, and the project menu', async () => {
  session = await openApp()
  const { app, page } = session
  await screens.createProject(page, 'Summer Launch')
  await createFrom(app, page, screens.E2E_BRIEF, screens.E2E_CAMPAIGN)
  await page.getByRole('tab', { name: 'Project' }).click()
  await createFrom(app, page, SECOND_BRIEF, SECOND_CAMPAIGN)
  const tabs = page.getByRole('tablist', { name: 'Open campaigns' }).getByRole('tab')
  await expect(tabs).toHaveCount(3)
  await page.waitForTimeout(300)
  await shot(page, '183-shell-two-campaigns')

  await page.getByRole('tab', { name: 'Project' }).click()
  await page.getByRole('button', { name: 'Summer Launch', exact: true }).click()
  await expect(page.getByRole('menu')).toBeVisible()
  await shot(page, '184-project-menu')
})
