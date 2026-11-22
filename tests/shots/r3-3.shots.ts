// R3-3: the Translations tab laid out like the Variants tab. 530, the English source block over
// German and French at two sizes; 531, an English text being edited; 532, after it is saved,
// the German translations of that text marked "Out of date". A campaign in English, German and
// French; the fake text provider proposes the translations. Fake providers only; nothing is paid
// and nothing leaves the machine. Made-up names only.
import { test, expect, type Page } from '@playwright/test'
import { showCampaignView } from '../e2e/campaign-view-steps'
import * as l from '../e2e/localize-steps'
import { command, query } from '../e2e/render-helpers'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

const CAMPAIGN = 'Harbour Lights Tea'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

async function still(page: Page) {
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
}

type Read = { rows: { status: string | null }[] }

async function setUp(page: Page) {
  await screens.createProject(page, 'Harbour Lights')
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  const projectId = state.openProjects[0]!.projectId
  const { campaignId } = (await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: CAMPAIGN,
      region: 'DE',
      audience: 'Walkers on a cold harbour evening',
      message: 'Warm tea by the water',
      callToAction: 'Take a cup',
      subjects: [{ name: 'Cup' }],
    },
    subjectMap: [{ subjectId: 'cup', create: true }],
    languages: ['en', 'de', 'fr'],
    sizes: [
      { label: '1080x1080', width: 1080, height: 1080 },
      { label: '1080x1920', width: 1080, height: 1920 },
    ],
    templateId: 'starter',
  })) as { campaignId: string }
  const first = (await query(page, 'campaign.get', { projectId, campaignId })) as {
    directions: { id: string }[]
  }
  await command(page, 'variant.fanOut', {
    projectId,
    directionId: first.directions[0]!.id,
    sizes: ['1080x1920'],
    languages: ['de', 'fr'],
    formats: ['image'],
    fits: { '1080x1920': 'scale' },
  })
  return { projectId, campaignId }
}

test('530 to 532 the Translations tab with its source block', async () => {
  test.setTimeout(240_000)
  session = await openApp()
  const { page } = session
  await still(page)
  await l.chooseFakeText(page)
  const { projectId, campaignId } = await setUp(page)
  await expect
    .poll(
      async () => {
        const read = (await query(page, 'translation.forCampaign', {
          projectId,
          campaignId,
        })) as Read
        return read.rows.map((r) => r.status)
      },
      { timeout: 60_000 },
    )
    .not.toContain('missing')

  await page.getByRole('button', { name: `Open ${CAMPAIGN}` }).click()
  await expect(page.getByRole('heading', { name: CAMPAIGN, level: 2 })).toBeVisible()
  await showCampaignView(page, 'Translations')
  const english = l.group(page, 'English')
  await expect(english.getByText('Source', { exact: true })).toBeVisible()
  await expect(l.group(page, 'French')).toBeVisible()
  await expect(l.translations(page).locator('img').first()).toBeVisible({ timeout: 30_000 })
  await page.mouse.move(0, 0)
  await shot(page, '530-r3-3-translations-source-and-languages')

  const field = english.getByRole('textbox').first()
  await field.click()
  await field.press('End')
  await field.pressSequentially(' tonight')
  await shot(page, '531-r3-3-source-text-being-edited')

  await field.press('Enter')
  await expect(l.group(page, 'German').getByText('Out of date').first()).toBeVisible()
  await l.group(page, 'German').scrollIntoViewIfNeeded()
  await page.mouse.move(0, 0)
  await shot(page, '532-r3-3-german-out-of-date-after-edit')
})
