// P6-10: the "Brand and legal rules" section of the campaign overview. The campaign comes from
// the S2-16 brief (made-up names); its one required word is cleared for the empty picture, then
// colours, a required file and word lists are added for the filled one, each saved as it goes.
import { test, expect, type Locator } from '@playwright/test'
import path from 'node:path'
import { showCampaignView } from '../e2e/campaign-view-steps'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

const BRIEF = path.resolve('tests/shots/fixtures/s2-16-brief.yaml')

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

async function writeWords(rules: Locator, label: string, text: string) {
  const field = rules.getByLabel(label)
  await field.fill(text)
  await field.blur()
  await expect(field).toHaveValue(text)
}

async function addColour(rules: Locator, hex: string) {
  await rules.getByLabel('Hex colour').fill(hex)
  await rules.getByRole('button', { name: 'Add colour' }).click()
  await expect(rules.getByRole('button', { name: `Remove ${hex}` })).toBeVisible()
}

test('The rule set panel, empty and filled', async () => {
  session = await openApp()
  const { app, page } = session
  await screens.createProject(page, 'Alpine Spring')
  await screens.answerOpenDialog(app, [BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  await page
    .getByRole('region', { name: 'Brief' })
    .getByRole('button', { name: 'Create campaign' })
    .click()
  await showCampaignView(page, 'Checks')
  const rules = page.getByRole('region', { name: 'Brand and legal rules' })
  await expect(rules.getByLabel('Required words (en)')).toHaveValue('Alpine Spring')

  await writeWords(rules, 'Required words (en)', '')
  await expect(rules.getByText('No colours.')).toBeVisible()
  await expect(rules.getByText('No required files.')).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '200-rule-set-empty')

  await addColour(rules, '#0B5FA5')
  await addColour(rules, '#F2C14E')
  await rules.getByRole('button', { name: 'Add a required file…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add a required file' })
  await dialog.getByRole('checkbox').first().check()
  await dialog.getByRole('button', { name: 'Add' }).click()
  await expect(dialog).toBeHidden()
  await expect(rules.getByRole('button', { name: /^Remove .*\.png$/ })).toBeVisible()
  await writeWords(rules, 'Required words (en)', 'Alpine Spring\nRefill')
  await writeWords(rules, 'Prohibited words (en)', 'cheap\nfree gift')
  await writeWords(rules, 'Required words (de)', 'Alpine Spring')
  await writeWords(rules, 'Prohibited words (de)', 'billig')
  await expect(rules.getByRole('alert')).toHaveCount(0)
  await page.waitForTimeout(300)
  await shot(page, '201-rule-set-filled')
})
