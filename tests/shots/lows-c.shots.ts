// Lows C: the fan-out dialog's "Formats" group, with the fake as the text provider (set with
// settings.update; no paid call, nothing leaves the computer). One campaign at two sizes in
// English and German. 214b: the dialog with one new size, German, and both Image and Video
// ticked, and its count line. Made-up names only.
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import { command, query } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

const CAMPAIGN = 'Lantern Lane Bakery'
const TALL = '1080x1920 (1080×1920)'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

async function setUp(page: Page) {
  await screens.createProject(page, 'Lantern Lane')
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  const projectId = state.openProjects[0]!.projectId
  await command(page, 'settings.update', { defaultProviders: { text: 'fake' } })
  await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: CAMPAIGN,
      region: 'US',
      audience: 'Early risers',
      message: 'Fresh bread before sunrise',
      callToAction: 'Order for the morning',
      subjects: [{ name: 'Loaf' }],
    },
    subjectMap: [{ subjectId: 'loaf', create: true }],
    languages: ['en', 'de'],
    sizes: [
      { label: '1080x1080', width: 1080, height: 1080 },
      { label: '1080x1920', width: 1080, height: 1920 },
    ],
    templateId: 'starter',
  })
}

test('Fan out with both formats ticked', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { page } = session
  await setUp(page)
  await page.getByRole('button', { name: `Open ${CAMPAIGN}` }).click()
  await expect(page.getByRole('heading', { name: CAMPAIGN, level: 2 })).toBeVisible()

  await page.getByRole('button', { name: 'Fan out…' }).click()
  const dialog = page.getByRole('dialog', { name: /^Fan out / })
  await dialog.getByRole('checkbox', { name: TALL }).check()
  await dialog.getByRole('checkbox', { name: 'de', exact: true }).check()
  await expect(dialog.getByRole('checkbox', { name: 'Image' })).toBeChecked()
  await dialog.getByRole('checkbox', { name: 'Video' }).check()
  await expect(dialog.getByText('This makes 7 variant(s).')).toBeVisible()
  await shot(page, '214b-fan-out-formats')
})
