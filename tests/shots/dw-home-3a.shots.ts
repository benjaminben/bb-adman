// HOME-3a (spec/phases/design-wave-screens-b.md, "HOME-3a"): the brief form's campaign fields,
// sizes, languages, rules and problems. 453: the form from its top to the sizes, with a typed
// size and one problem, so the "{n} to fix" mark shows in the foot. 454: Rules open with two
// languages, the second language's word lists shown. The words on the form are counted into
// shots/453-words.txt. Made-up names and drawn pictures only; no provider runs.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

test('the brief form: fields, size chips, languages, rules and the problems', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { app, page } = session
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()

  await screens.createProject(page, 'Tidewater Coffee')
  await screens.answerOpenDialog(app, [screens.E2E_BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  const form = page.getByRole('region', { name: 'New campaign' })
  await screens.expectPhoto(form, 1, screens.E2E_PHOTO)
  await form.getByLabel('Languages', { exact: true }).fill('en, fr-CA')
  const words = await form.evaluate((el) => (el as HTMLElement).innerText.split(/\s+/).length)
  fs.mkdirSync('shots', { recursive: true })
  fs.writeFileSync(path.join('shots', '453-words.txt'), `${words}\n`)

  const sizes = form.getByRole('group', { name: 'Sizes' })
  await sizes.getByRole('button', { name: '16x9 (1920×1080)', exact: true }).click()
  await sizes.getByLabel('Other sizes', { exact: true }).fill('4:5, 1200x628')
  await sizes.getByRole('button', { name: 'Master: 16x9', exact: true }).click()
  await form.getByLabel('Audience', { exact: true }).fill('')
  await expect(form.getByRole('button', { name: '1 to fix: go to the list' })).toBeVisible()
  await form.getByLabel('Campaign name').focus()
  await page.mouse.move(1200, 780)
  await page.waitForTimeout(500)
  await shot(page, '453-brief-form-top-to-sizes')

  await form.getByLabel('Audience', { exact: true }).fill('Adults who spend weekends outdoors')
  await form.getByRole('button', { name: 'Rules', exact: true }).click()
  const rules = form.getByRole('group', { name: 'Rules', exact: true })
  await rules.getByLabel('Prohibited words (en)').fill('cheap\nsugar-free')
  await rules.getByRole('button', { name: 'fr-CA', exact: true }).click()
  await rules.getByLabel('Required words (fr-CA)').fill('Harness Check\nRentrée')
  await rules.getByLabel('Prohibited words (fr-CA)').fill('bon marché')
  await page.mouse.move(1200, 780)
  await page.waitForTimeout(500)
  await shot(page, '454-brief-form-rules-open')
})
