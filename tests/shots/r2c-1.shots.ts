// R2C-1 (spec/phases/round-2-campaign.md, design addition 1): the campaign overview's view bar.
// 343: Translations with one language. Then German is added (campaign.update, variant.add and
// made-up words with translation.set, through the window's api as a screen would). 340: the
// Variants tab. 341: the Checks tab with its warning badge, after "Run checks" with a
// prohibited word and a required word the post lacks. 342: the Translations tab.
// Made-up names only; only the fake provider runs.
import { test, expect, type Page } from '@playwright/test'
import { showCampaignView } from '../e2e/campaign-view-steps'
import { command, query } from '../e2e/render-helpers'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

const CAMPAIGN = 'Harbour Blend'
const GERMAN = 'Frisch geröstet am Hafen'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

type Place = { projectId: string; campaignId: string }

async function makeCampaign(page: Page): Promise<Place> {
  await screens.createProject(page, 'Tidewater Coffee')
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  const projectId = state.openProjects[0]!.projectId
  const { campaignId } = (await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: CAMPAIGN,
      region: 'US',
      audience: 'Early risers who walk to work',
      message: 'A bold roast from the harbour',
      callToAction: 'Find your cup',
      subjects: [{ name: 'Coffee bag' }],
    },
    subjectMap: [{ subjectId: 'coffee-bag', create: true }],
    languages: ['en'],
    sizes: [{ label: '1080x1080', width: 1080, height: 1080 }],
    templateId: 'starter',
  })) as { campaignId: string }
  await page.getByRole('button', { name: `Open ${CAMPAIGN}` }).click()
  await expect(page.getByRole('heading', { name: CAMPAIGN, level: 2 })).toBeVisible()
  return { projectId, campaignId }
}

async function addGerman(page: Page, place: Place): Promise<void> {
  await command(page, 'campaign.update', { ...place, languages: ['en', 'de'] })
  const got = (await query(page, 'campaign.get', place)) as { directions: { id: string }[] }
  const directionId = got.directions[0]!.id
  const post = { projectId: place.projectId, directionId, sizeLabel: '1080x1080' }
  await command(page, 'variant.add', { ...post, language: 'de', format: 'image' })
  const read = (await query(page, 'translation.forCampaign', place)) as {
    rows: { layerId: string }[]
  }
  for (const row of read.rows) {
    const input = { layerId: row.layerId, text: GERMAN, applyToSameLanguage: false }
    await command(page, 'translation.set', { projectId: place.projectId, ...input })
  }
}

test('the campaign view tabs: Variants, Checks with its badge, Translations', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { page } = session
  const place = await makeCampaign(page)

  await showCampaignView(page, 'Translations')
  await expect(page.getByText(/^This campaign has one language, English,/)).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '343-campaign-one-language')

  await addGerman(page, place)
  await showCampaignView(page, 'Variants')
  await expect(page.getByRole('list', { name: /^Variants in / }).getByRole('listitem')).toHaveCount(
    2,
  )
  await page.waitForTimeout(500)
  await shot(page, '340-campaign-variants-tab')

  await command(page, 'ruleSet.update', {
    ...place,
    requiredWords: { en: ['Linnea Park'] },
    prohibitedWords: { en: ['harbour'] },
  })
  await showCampaignView(page, 'Checks')
  const checks = page.getByRole('region', { name: 'Checks' })
  await checks.getByRole('button', { name: 'Run checks' }).click()
  await expect(checks.getByText('Checking…')).toHaveCount(0)
  await expect(page.getByRole('tab', { name: /^Checks \d+ warning\(s\)$/ })).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '341-campaign-checks-tab-badge')

  await showCampaignView(page, 'Translations')
  await expect(page.getByRole('region', { name: /^German · / })).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '342-campaign-translations-tab')
})
