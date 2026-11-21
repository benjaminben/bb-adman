// P4-12: the paid count. The campaign comes from the S2-16 brief; its overview shows the paid
// count under the campaign name. The run dialog itself has no screen that opens it yet (P4-13
// and later mount it), so its pictures (73 to 75) wait for those slices.
import { test, expect } from '@playwright/test'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

const BRIEF = path.resolve('tests/shots/fixtures/s2-16-brief.yaml')

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

test('The paid count on the campaign overview', async () => {
  session = await openApp()
  const { app, page } = session
  await screens.createProject(page, 'Alpine Spring')
  await screens.answerOpenDialog(app, [BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  await page
    .getByRole('region', { name: 'Brief' })
    .getByRole('button', { name: 'Create campaign' })
    .click()
  await expect(page.getByRole('list', { name: 'Variants' }).getByRole('listitem')).toHaveCount(1)
  await expect(page.getByText(/^Paid generations for this campaign so far:/)).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '76-campaign-paid-count')
})
