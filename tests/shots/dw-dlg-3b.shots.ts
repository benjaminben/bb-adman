// DLG-3b: 474 the import dialog with nine pictures (six icon tiles and "+3", no path); 475
// "Paste a brief" with a refusal; 476 the brief reading dialog after a failure, with "Type it"
// and "Retry". The native picker is answered through the e2e helper. The failure comes from
// the Gemini stand-in (gemini-answers.ts): no request leaves the computer, the key is made up
// and nothing is paid. Made-up names only.
import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { answerGemini, installGemini } from '../e2e/gemini-answers'
import { MADE_UP_KEY } from '../e2e/gemini-stand-in'
import { answerQuit } from '../e2e/quit-answer'
import { command } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

const PHOTOS = path.resolve('tests/fixtures/briefs/photos')
const BRIEF = path.resolve('tests/fixtures/briefs/p4-15-brief.md')

let session: Session | undefined

test.afterEach(async () => {
  if (session) await answerQuit(session.app)
  await closeApp(session)
  session = undefined
})

async function still(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
}

test('474 the import dialog with nine pictures', async () => {
  session = await openApp()
  const { app, box, page } = session
  await still(page)
  await screens.createProject(page, 'Tidewater Coffee')
  const folder = path.join(box.root, 'Made Up Shoot')
  fs.mkdirSync(folder)
  const files = Array.from({ length: 9 }, (_, i) => {
    const to = path.join(folder, `harbour-blend-${i + 1}.png`)
    fs.copyFileSync(path.join(PHOTOS, i % 2 === 0 ? 'citrus-can.png' : 'berry-bottle.png'), to)
    return to
  })
  await screens.answerOpenDialog(app, files)
  await page.getByRole('button', { name: 'Import files…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Import 9 files' })
  await expect(dialog.getByRole('list', { name: 'Files to import' }).locator('li')).toHaveCount(6)
  await expect(dialog.getByText('+3')).toBeVisible()
  expect(await dialog.innerHTML()).not.toContain('Made Up Shoot')
  await page.waitForTimeout(300)
  await shot(page, '474-import-nine-pictures')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
})

test('475 paste a brief with a refusal', async () => {
  session = await openApp()
  const { page } = session
  await still(page)
  await screens.createProject(page, 'Tidewater Coffee')
  await page.getByRole('button', { name: 'Paste a brief' }).click()
  const dialog = page.getByRole('dialog', { name: 'Paste a brief' })
  await dialog.getByLabel('Brief text').fill('A few loose words about a coffee tin')
  await dialog.getByRole('button', { name: 'Read brief' }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '475-paste-brief-refused')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
})

test('476 the brief reading dialog after a failure', async () => {
  session = await openApp()
  const { app, page } = session
  await installGemini(app)
  await answerGemini(app, 'offline')
  await still(page)
  await command(page, 'secret.set', { name: 'gemini.apiKey', value: MADE_UP_KEY })
  await screens.createProject(page, 'Harbour Lights')
  await screens.answerOpenDialog(app, [BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  const run = page.getByRole('dialog', { name: 'Read the brief with AI' })
  await run.getByRole('radio', { name: 'Google Gemini' }).check()
  await run.getByRole('button', { name: 'Read brief' }).click()
  const reading = page.getByRole('dialog', { name: 'Reading the brief' })
  const byHand = reading.getByRole('button', { name: 'Fill the form by hand' })
  await expect(byHand).toHaveText('Type it')
  await expect(reading.getByRole('button', { name: 'Retry' })).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '476-brief-reading-failed')
  await byHand.click()
  await expect(page.getByRole('region', { name: 'New campaign' })).toBeVisible()
})
