// P3-10: the shell and the tabs. A project with two campaigns made from the S2-16 brief (the
// second renamed in the form), both open as campaign tabs. Then the variant tabs: the overview
// with the master opened behind by its "+", and the master's tab showing the editor. Only
// campaign.create makes variants today, one per campaign, so a campaign has one variant tab.
import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

const BRIEF = path.resolve('tests/shots/fixtures/s2-16-brief.yaml')

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

async function createCampaign(page: Page, name?: string) {
  await page.getByRole('button', { name: 'Load a brief' }).click()
  const brief = page.getByRole('region', { name: 'Brief' })
  if (name) await brief.getByLabel('Campaign name').fill(name)
  await brief.getByRole('button', { name: 'Create campaign' }).click()
  await expect(page.getByRole('list', { name: 'Variants' })).toBeVisible()
}

test('The shell and the tabs', async () => {
  session = await openApp()
  const { app, page } = session
  await screens.createProject(page, 'Alpine Spring')
  await screens.answerOpenDialog(app, [BRIEF])
  await createCampaign(page)
  await page.getByRole('tab', { name: 'Project' }).click()
  await screens.answerOpenDialog(app, [BRIEF])
  await createCampaign(page, 'Autumn Trail Run')
  await expect(page.getByRole('tablist', { name: 'Open campaigns' }).getByRole('tab')).toHaveCount(
    3,
  )
  await page.waitForTimeout(300)
  await shot(page, '40-shell-campaign-tabs')

  await page.getByRole('button', { name: /^Open .* in a tab$/ }).click()
  await expect(page.getByRole('tablist', { name: 'Open variants' }).getByRole('tab')).toHaveCount(2)
  await page.waitForTimeout(300)
  await shot(page, '41-overview-variant-behind')

  await page.getByRole('tablist', { name: 'Open variants' }).getByRole('tab').nth(1).click()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
  await page.waitForTimeout(500)
  await shot(page, '42-variant-tab-editor')
})
