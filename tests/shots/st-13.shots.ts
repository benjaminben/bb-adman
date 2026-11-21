// ST-13: the project home in the app style. One campaign card with its cover, then the brief
// form of a loaded two-subject brief: the fields two to a line, the message in the reading face.
// Every picture is a made-up drawing from the fixtures; no provider runs.
import { test, expect } from '@playwright/test'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

const TWO_SUBJECTS = path.resolve('tests/fixtures/briefs/s2-13-brief.yaml')
const BERRY = path.resolve('tests/fixtures/briefs/photos/berry-bottle.png')

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

test('The project home: a campaign card, then a loaded brief in the form', async () => {
  session = await openApp()
  const { app, page } = session
  await screens.createProject(page, 'Lakeside Drinks')
  await screens.loadBriefAndCreate(app, page)
  await expect(page.getByRole('img', { name: `Cover of ${screens.E2E_CAMPAIGN}` })).toBeVisible()

  await screens.answerOpenDialog(app, [TWO_SUBJECTS])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  const brief = page.getByRole('region', { name: 'Brief' })
  await screens.expectPhoto(brief, 2, BERRY)
  await page.waitForTimeout(300)
  await shot(page, '199-project-home-brief')
})
