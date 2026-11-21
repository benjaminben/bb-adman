// P4-15: reading a Markdown brief with AI. The brief is the made-up
// tests/fixtures/briefs/p4-15-brief.md. 83: the reading dialog, caught by holding a Gemini
// request (held-run.ts: no request leaves the computer, the key is made up). 84: the brief form
// filled by the fake provider.
import { test, expect } from '@playwright/test'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { holdGemini } from '../e2e/held-run'
import { MADE_UP_KEY } from '../e2e/gemini-stand-in'
import { answerQuit } from '../e2e/quit-answer'
import { command } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

const BRIEF = path.resolve('tests/fixtures/briefs/p4-15-brief.md')

let session: Session | undefined

test.afterEach(async () => {
  if (session) await answerQuit(session.app)
  await closeApp(session)
  session = undefined
})

test('The reading dialog while Gemini reads the brief', async () => {
  session = await openApp()
  const { app, page } = session
  await holdGemini(app)
  await command(page, 'secret.set', { name: 'gemini.apiKey', value: MADE_UP_KEY })
  await screens.createProject(page, 'Harbour Lights')
  await screens.answerOpenDialog(app, [BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  const run = page.getByRole('dialog', { name: 'Read the brief with AI' })
  await run.getByRole('radio', { name: 'Google Gemini' }).check()
  await run.getByRole('button', { name: 'Read brief' }).click()
  const reading = page.getByRole('dialog', { name: 'Reading the brief' })
  await expect(reading.getByText('Google Gemini is reading the brief…')).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '83-brief-reading')

  await reading.getByRole('button', { name: 'Stop' }).click()
  await expect(reading).toHaveCount(0)
})

test('The brief form filled from a Markdown brief', async () => {
  session = await openApp()
  const { app, page } = session
  await screens.createProject(page, 'Harbour Lights')
  await screens.answerOpenDialog(app, [BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  const run = page.getByRole('dialog', { name: 'Read the brief with AI' })
  await run.getByRole('radio', { name: 'Fake provider' }).check()
  await run.getByRole('button', { name: 'Read brief' }).click()
  const form = page.getByRole('region', { name: 'Brief' })
  await expect(form.getByLabel('Campaign name')).toHaveValue('Harbour Lights')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.waitForTimeout(300)
  await shot(page, '84-brief-form-filled')
})
