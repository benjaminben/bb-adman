// S2-13: the brief form filled from a loaded brief, the empty "Type a brief" form with its
// problems listed, and a typed form with three subject rows, one of them a subject the project
// already holds.
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

test('the brief form', async () => {
  session = await openApp()
  const { app, page } = session
  await screens.createProject(page, 'Lakeside Drinks')

  await screens.answerOpenDialog(app, [BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  const brief = page.getByRole('region', { name: 'Brief' })
  await expect(brief.getByRole('list', { name: 'Subjects' })).toBeVisible()
  // SP-5: the brief names a photo for each subject; the picture waits for both.
  await screens.expectPhoto(brief, 1, path.resolve('tests/fixtures/briefs/photos/citrus-can.png'))
  await screens.expectPhoto(brief, 2, path.resolve('tests/fixtures/briefs/photos/berry-bottle.png'))
  await shot(page, '01-brief-form-loaded')

  await brief.getByRole('button', { name: 'Create campaign' }).click()
  await page.getByRole('button', { name: 'Back to project' }).click()

  await page.getByRole('button', { name: 'Paste a brief' }).click()
  await page.getByRole('button', { name: 'Start from an empty form' }).click()
  await expect(brief.getByText('Before the campaign can be made')).toBeVisible()
  await shot(page, '02-brief-form-typed-empty')

  await brief.getByLabel('Campaign name').fill('Back to Class')
  await brief.getByLabel('Region').fill('France')
  await brief.getByLabel('Region').blur()
  await brief.getByLabel('Audience').fill('Students heading back to university')
  await brief.getByLabel('Message').fill('Fresh fizz for every lecture.')
  const row = (n: number) => brief.getByRole('group', { name: `Subject ${n}` })
  await row(1).getByLabel('Name').fill('Apple can')
  await row(1).getByLabel('Subject ID').fill('apple-can')
  await brief.getByRole('button', { name: 'Add subject' }).click()
  await row(2).getByLabel('Name').fill('Citrus can')
  await row(2).getByLabel('Use a subject this project has').check()
  await row(2).getByLabel('Project subject').selectOption('citrus-can')
  await brief.getByRole('button', { name: 'Add subject' }).click()
  await row(3).getByLabel('Name').fill('Pear bottle')
  await row(3).getByLabel('Description (optional)').fill('A short green bottle')
  await row(3).getByLabel('Subject ID').fill('pear bottle')
  await shot(page, '03-brief-form-three-subjects')
})
