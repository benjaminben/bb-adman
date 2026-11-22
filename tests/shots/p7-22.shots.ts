// P7-22: the "Make a video" card on the fake provider. 237: an image post, with the line
// "Change this post to video first." and Start disabled. 238: the post switched to video in the
// editor's top bar, with "The post's background" chosen (the brief's post has no background
// picture, so the card starts on "A prompt") and the offer's length. 239: a start
// from reference pictures, two of the offer's four ticked.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from '@playwright/test'
import { greyPng } from '@/main/providers/fake/png'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  try {
    await closeApp(session)
  } finally {
    session = undefined
  }
})

const PROMPT = 'The citrus can turns slowly as cold drops run down its side'

test('the video card: an image post, the background start, reference pictures', async () => {
  session = await openApp()
  const { app, page, box } = session
  await screens.createProject(page, 'Lemon Fizz')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  const card = screens.videoPanel(page)
  await card.getByLabel('Provider').selectOption({ label: 'Fake provider' })
  await card.getByLabel('Prompt').fill(PROMPT)
  await expect(card.getByText('Change this post to video first.')).toBeVisible()
  await expect(card.getByRole('button', { name: 'Start' })).toBeDisabled()
  await card.scrollIntoViewIfNeeded()
  await shot(page, '237-video-card-image-post')

  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().click()
  const format = page.getByRole('radiogroup', { name: 'Format' })
  await format.getByRole('radio', { name: 'Video' }).click()
  await expect(format.getByRole('radio', { name: 'Video' })).toBeChecked()
  await page.getByRole('tab', { name: 'Overview' }).click()
  await card.getByLabel('Provider').selectOption({ label: 'Fake provider' })
  await card.getByLabel('Prompt').fill(PROMPT)
  await card.getByLabel('Start from').selectOption({ label: "The post's background" })
  await expect(card.getByText('Change this post to video first.')).toHaveCount(0)
  await expect(card.getByRole('button', { name: 'Start' })).toBeEnabled()
  await card.scrollIntoViewIfNeeded()
  await shot(page, '238-video-card-background-start')

  await card.getByLabel('Start from').selectOption({ label: 'A reference picture' })
  const pictures = card.getByRole('region', { name: 'Picture to start from' })
  // Two made-up grey pictures of different sizes, so each is its own asset.
  const files = ['lemon-slices.png', 'ice-cubes.png'].map((name, i) => {
    const file = path.join(box.root, name)
    fs.writeFileSync(file, greyPng(320 + i * 40, 240))
    return file
  })
  await screens.answerOpenDialog(app, files)
  await pictures.getByRole('button', { name: 'Add pictures' }).click()
  const boxes = pictures.getByRole('checkbox')
  await expect(boxes).toHaveCount(3)
  await boxes.nth(1).check()
  await expect(boxes.nth(1)).toBeChecked()
  await card.scrollIntoViewIfNeeded()
  await shot(page, '239-video-card-reference-pictures')
})
