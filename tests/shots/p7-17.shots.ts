// P7-17: the format controls in the editor's top bar. 220: an image variant. 221: the same
// variant changed to video through the control, with its length set.
import { test, expect } from '@playwright/test'
import * as screens from '../e2e/screens'
import { timeline } from '../e2e/timeline-seed'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  try {
    await closeApp(session)
  } finally {
    session = undefined
  }
})

test('the format choice on an image variant, then a video with its length', async () => {
  session = await openApp()
  const { app, page } = session
  await screens.createProject(page, 'Lemon Fizz')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().dblclick()
  const format = page.getByRole('radiogroup', { name: 'Format' })
  await expect(format.getByRole('radio', { name: 'Image' })).toBeChecked()
  await shot(page, '220-format-image')

  await format.getByRole('radio', { name: 'Video' }).click()
  await expect(timeline(page)).toBeVisible()
  const length = page.getByRole('textbox', { name: 'Length (seconds)' })
  await length.fill('15')
  await length.press('Enter')
  await expect(timeline(page).getByText('0:00.0 / 0:15.0')).toBeVisible()
  await shot(page, '221-format-video-length')
})
