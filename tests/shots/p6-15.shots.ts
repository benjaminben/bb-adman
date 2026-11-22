// P6-15: translation at fan-out, with the fake as the text provider (set with settings.update,
// as the Settings screen does; no paid call, nothing leaves the computer). One campaign at two
// sizes in English, German and Japanese; the brief gives the German headline. 211: the fan-out
// dialog with one new size and both languages ticked, and its text-call line. 212: the grid
// after "Make variants", once the fake's translations are written, with the "Translation not
// approved" marks. Made-up names only.
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import { command, query } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

const CAMPAIGN = 'Harbour Lights Tea'
const TALL = '1080x1920 (1080×1920)'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

async function setUp(page: Page) {
  await screens.createProject(page, 'Harbour Lights')
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
      audience: 'Evening walkers',
      message: 'A warm cup by the water',
      callToAction: 'Try the new blend',
      subjects: [{ name: 'Tin' }],
      copy: { de: { headline: 'Eine warme Tasse am Wasser' } },
    },
    subjectMap: [{ subjectId: 'tin', create: true }],
    languages: ['en', 'de', 'ja'],
    sizes: [
      { label: '1080x1080', width: 1080, height: 1080 },
      { label: '1080x1920', width: 1080, height: 1920 },
    ],
    templateId: 'starter',
  })
}

test('Translation at fan-out: the text-call line and the marks on the grid', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { page } = session
  await setUp(page)
  await page.getByRole('button', { name: `Open ${CAMPAIGN}` }).click()
  await expect(page.getByRole('heading', { name: CAMPAIGN, level: 2 })).toBeVisible()

  await page.getByRole('button', { name: 'Fan out…' }).click()
  const dialog = page.getByRole('dialog', { name: /^Fan out / })
  await dialog.getByRole('checkbox', { name: TALL }).check()
  await dialog.getByRole('checkbox', { name: 'de' }).check()
  await dialog.getByRole('checkbox', { name: 'ja' }).check()
  const line = 'Translating 2 language(s) uses the fake provider. Nothing is charged.'
  await expect(dialog.getByText(line)).toBeVisible()
  await expect(dialog.getByText('This makes 5 variant(s).')).toBeVisible()
  await shot(page, '211-fan-out-text-call-line')

  const grid = page.getByRole('list', { name: /^Variants in / })
  await dialog.getByRole('button', { name: 'Make variants' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(grid.getByRole('listitem')).toHaveCount(6)
  await expect(grid.getByText('Translation not approved')).toHaveCount(4, { timeout: 60_000 })
  await shot(page, '212-grid-translation-not-approved')
})
