// HOME-3b (spec/phases/design-wave-screens-b.md, "HOME-3b"): the brief form's subjects. 455:
// two subjects, the first with two photos, the second with no photo and a note from a file
// that is not there, "Place first photo" under them. The words on the form are counted at the same moment as
// HOME-3a's count (brief loaded, two languages) into shots/455-words.txt. Made-up names and
// drawn pictures only; no provider runs.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

const BERRY = path.resolve('tests/fixtures/briefs/photos/berry-bottle.png')
// A file that is not there: its import is refused and the refusal is the row's note.
const GONE = path.resolve('tests/fixtures/briefs/photos/paper-sachet.png')

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

test('the brief form: two subjects with photos and a note', async () => {
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
  fs.writeFileSync(path.join('shots', '455-words.txt'), `${words}\n`)

  await screens.addPhoto(app, form, 1, BERRY)
  await form.getByRole('button', { name: 'Add subject' }).click()
  const second = form.getByRole('group', { name: 'Subject 2', exact: true })
  await second.getByLabel('Name', { exact: true }).fill('Paper sachet')
  await second.getByLabel('Description (optional)').fill('A single-serve pour-over sachet')
  await screens.answerOpenDialog(app, [GONE])
  await form.getByRole('button', { name: 'Add photos to subject 2' }).click()
  await expect(form.getByRole('list', { name: 'Notes on the photos of subject 2' })).toBeVisible()
  await form.getByRole('heading', { name: 'Subjects' }).scrollIntoViewIfNeeded()
  await page.mouse.move(1200, 780)
  await page.waitForTimeout(500)
  await shot(page, '455-brief-form-subjects')
})
