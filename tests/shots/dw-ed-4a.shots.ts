// ED-4a (spec/phases/design-wave-screens-a.md): the Generate panel's top half. 429: a new
// picture layer on an image post: "Make" with "Video" disabled, "Start from" as tiles, the
// subject's photo and one added picture in the reference strip, the prompt and Generate…. 430:
// the background of a video post with "Video" chosen, "Reference pictures" as the start and
// two pictures ticked. Nothing is generated: no run dialog is opened. Made-up words and a drawn
// grey picture only.
import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { greyPng } from '@/main/providers/fake/png'
import * as screens from '../e2e/screens'
import { format } from '../e2e/video-variant-steps'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

// A still window (reduce motion, a fixed Math.random), a project and the brief's campaign,
// its master open in the editor.
async function campaign(s: Session, name: string): Promise<void> {
  const { app, page } = s
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await screens.createProject(page, name)
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  await screens.openMaster(page)
}

async function still(page: Page, name: string): Promise<void> {
  await page.mouse.move(640, 790)
  await page.waitForTimeout(400)
  await shot(page, name)
}

test('429 the Generate panel of a picture layer on an image post', async () => {
  test.setTimeout(150_000)
  session = await openApp()
  const { app, page, box } = session
  await campaign(session, 'Harbour Lights')
  await page.getByRole('button', { name: 'Add picture layer' }).click()
  const panel = screens.picturePanel(page)
  await expect(panel.getByRole('textbox', { name: 'Prompt' })).toBeEnabled()
  const file = path.join(box.root, 'harbour-grey.png')
  fs.writeFileSync(file, greyPng(32, 24))
  await panel.getByRole('button', { name: 'Choose reference pictures…' }).click()
  const chooser = page.getByRole('dialog', { name: /^Reference pictures for / })
  await screens.answerOpenDialog(app, [file])
  const references = chooser.getByRole('region', { name: 'Reference pictures' })
  await references.getByRole('button', { name: 'Add pictures' }).click()
  const boxes = references.getByRole('checkbox')
  await expect(boxes).toHaveCount(2)
  for (const tick of await boxes.all()) await tick.check()
  await chooser.getByRole('button', { name: 'Done' }).click()
  await expect(screens.referenceThumbs(panel)).toHaveCount(2)
  await panel.getByRole('textbox', { name: 'Prompt' }).fill('A lantern on a quiet harbour wall')
  await still(page, '429-generate-picture-layer')
})

test('430 the background of a video post, Video chosen, two reference pictures', async () => {
  test.setTimeout(150_000)
  session = await openApp()
  const { app, page, box } = session
  await campaign(session, 'Harbour Lights')
  await format(page).getByRole('radio', { name: 'Video' }).click()
  await expect(format(page).getByRole('radio', { name: 'Video' })).toBeChecked()
  const panel = await screens.videoPanel(page)
  await screens.chooseStart(panel, screens.VIDEO_REFERENCE_START)
  const list = panel.getByRole('region', { name: 'Picture to start from' })
  await expect(list.locator('input:checked')).toHaveCount(1)
  const file = path.join(box.root, 'harbour-grey.png')
  fs.writeFileSync(file, greyPng(32, 24))
  await screens.answerOpenDialog(app, [file])
  await list.getByRole('button', { name: 'Add pictures' }).click()
  await expect(list.locator('input:checked')).toHaveCount(2)
  await panel.getByRole('textbox', { name: 'Prompt' }).fill('Lanterns flicker along the harbour')
  await page.getByRole('button', { name: /^Activity/ }).click()
  await expect(screens.activityPanel(page)).toBeHidden()
  await still(page, '430-generate-video-references')
})
