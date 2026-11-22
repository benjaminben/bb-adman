// HOME-2 (spec/phases/design-wave-screens-b.md, "HOME-2"): the New campaign page from a loaded
// brief. 452: the whole page down to its foot. 452b: the window as it is, the foot held at its
// bottom while the page scrolls. 452c: Back with typed work asks "Leave this brief?".
// Made-up names and drawn pictures only; no provider runs.
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

test('the New campaign page, its foot and the leave question', async () => {
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
  await expect(form.getByLabel('Campaign name')).toBeFocused()
  const words = await form.evaluate((el) => (el as HTMLElement).innerText.split(/\s+/).length)
  fs.mkdirSync('shots', { recursive: true })
  fs.writeFileSync(path.join('shots', '452-words.txt'), `${words}\n`)
  await page.mouse.move(1200, 780)
  await page.waitForTimeout(500)
  await shot(page, '452-new-campaign-page')

  await page.screenshot({ path: path.join('shots', '452b-new-campaign-foot-held.png') })

  await form.getByLabel('Campaign name').fill('Harbour Blend autumn')
  await form.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('dialog', { name: 'Leave this brief?' })).toBeVisible()
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join('shots', '452c-new-campaign-leave-question.png') })
})
