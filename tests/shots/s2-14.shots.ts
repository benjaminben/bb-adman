// S2-14: the brief form's sizes, languages and rules filled in by hand; the rules copied from
// another campaign of the project; and the problems an unreadable size and a right-to-left
// language give.
import { test, expect } from '@playwright/test'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

const BRIEF = path.resolve('tests/fixtures/briefs/s2-13-brief.yaml')

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

test('the brief form: sizes, languages and rules', async () => {
  session = await openApp()
  const { app, page } = session
  await screens.createProject(page, 'Lakeside Drinks')

  // A first campaign, so "Copy the rules from another campaign" has one to offer.
  await screens.answerOpenDialog(app, [BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  const brief = page.getByRole('region', { name: 'Brief' })
  await brief.getByRole('button', { name: 'Create campaign' }).click()
  await page.getByRole('button', { name: 'Back to project' }).click()

  await page.getByRole('button', { name: 'Type a brief' }).click()
  await brief.getByLabel('Campaign name').fill('Back to Class')
  await brief.getByLabel('Region').fill('Canada')
  await brief.getByLabel('Region').blur()
  await brief.getByLabel('Audience').fill('Students heading back to college in September')
  await brief.getByLabel('Message').fill('Fresh fizz for every lecture.')
  await brief.getByLabel('Offer (optional)').fill('A free can with every student card')
  const row = brief.getByRole('group', { name: 'Subject 1' })
  await row.getByLabel('Name').fill('Apple can')
  await row.getByLabel('Description (optional)').fill('A green can with a red apple label')
  // SP-5: a subject needs a photo before Create; one the first campaign does not use.
  await screens.addPhoto(
    app,
    brief,
    1,
    path.resolve('tests/shots/fixtures/photos/glass-bottle.png'),
  )

  const sizes = brief.getByRole('group', { name: 'Sizes' })
  await sizes.getByRole('checkbox', { name: '16x9 (1920×1080)' }).uncheck()
  await sizes.getByRole('checkbox', { name: '4x5 (1080×1350)' }).check()
  await sizes.getByLabel('Other sizes').fill('1200x628, 1.91:1')
  await sizes.getByLabel('Master size').selectOption('4x5')
  await brief.getByLabel('Languages').fill('en, fr-CA')
  const rules = brief.getByRole('group', { name: 'Rules' })
  await rules.getByLabel('Required words (en)').fill('Back to Class\nLakeside')
  await rules.getByLabel('Prohibited words (en)').fill('cheap\nsugar-free')
  await rules.getByLabel('Required words (fr-CA)').fill('Rentrée\nLakeside')
  await rules.getByLabel('Prohibited words (fr-CA)').fill('bon marché')
  await expect(brief.getByRole('button', { name: 'Create campaign' })).toBeEnabled()
  await shot(page, '01-brief-form-sizes-languages-rules')

  await rules.getByLabel('Copy the rules from another campaign').check()
  await rules.getByLabel('Campaign to copy from').selectOption({ label: 'Lakeside Summer' })
  await shot(page, '02-brief-form-copy-rules')

  await rules.getByLabel('Use these word lists').check()
  await sizes.getByLabel('Other sizes').fill('1200x628, 1.91:1, banner')
  await brief.getByLabel('Languages').fill('en, ar')
  await expect(brief.getByText('Before the campaign can be made')).toBeVisible()
  await shot(page, '03-brief-form-problems')
})
