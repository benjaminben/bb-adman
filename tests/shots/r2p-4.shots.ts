// R2P-4 (spec/phases/round-2-platform.md, D4): the "Paste a brief" dialog empty, then with a
// Markdown brief pasted in, then the brief form that brief opens with its photo added. The
// photo is a made-up drawing copied into the sandbox, so its full path names no real folder.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

const PHOTO = path.resolve('tests/shots/fixtures/photos/glass-bottle.png')

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

function markdownBrief(picture: string): string {
  return [
    '# Spring Glow launch',
    '',
    'Region: Canada',
    'Audience: Adults 25 to 40 who buy skin care online',
    'Call to action: Shop the serum',
    'Tone: Warm and plain',
    '',
    '## Message',
    'Glow that lasts from morning to night.',
    '',
    '## Languages',
    '- en',
    '- fr',
    '',
    '## Sizes',
    '- 1:1',
    '- 9:16',
    '',
    '## Subjects',
    '',
    '### Citrus Glow serum',
    'ID: citrus-glow',
    'Description: A 30 ml glass dropper bottle with an orange label',
    'Pictures:',
    `- ${picture}`,
    '',
  ].join('\n')
}

test('Paste a brief', async () => {
  session = await openApp()
  const { box, page } = session
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await screens.createProject(page, 'Lakeside Beauty')
  const picture = path.join(box.root, 'citrus-glow-front.png')
  fs.copyFileSync(PHOTO, picture)

  await page.getByRole('button', { name: 'Paste a brief' }).click()
  const dialog = page.getByRole('dialog', { name: 'Paste a brief' })
  await expect(dialog.getByLabel('Brief text')).toBeFocused()
  await shot(page, '370-brief-paste-empty')

  await dialog.getByLabel('Brief text').fill(markdownBrief(picture))
  await expect(dialog.getByRole('button', { name: 'Read brief' })).toBeEnabled()
  await dialog.getByLabel('Brief text').evaluate((area) => area.scrollTo(0, 0))
  await shot(page, '371-brief-paste-markdown')

  await dialog.getByRole('button', { name: 'Read brief' }).click()
  const brief = page.getByRole('region', { name: 'Brief' })
  await expect(brief.getByLabel('Campaign name')).toHaveValue('Spring Glow launch')
  await screens.expectPhoto(brief, 1, picture)
  await expect(brief.getByText(/^This brief added 1 photo\(s\)\./)).toBeVisible()
  await shot(page, '372-brief-paste-form')
})
