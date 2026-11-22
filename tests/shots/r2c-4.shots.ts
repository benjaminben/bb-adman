// R2C-4 (spec/phases/round-2-campaign.md, design addition 4): the Translations tab shows each
// row's source under "English (source)" beside the field under "German". 350: the rows at the
// usual width. 351: a window 680 wide, where each pair stacks. German is added and its
// texts set through the window's api as a screen would; the last text is left missing.
// Made-up names only; only the fake provider runs.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { showCampaignView } from '../e2e/campaign-view-steps'
import { command, query } from '../e2e/render-helpers'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

const CAMPAIGN = 'Harbour Blend'
const GERMAN = ['Frisch geröstet am Hafen', 'Für Frühaufsteher', 'Finde deine Tasse']

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

// German is added with one post; every German row but the last gets made-up words.
async function translate(page: Page, place: Place): Promise<void> {
  await command(page, 'campaign.update', { ...place, languages: ['en', 'de'] })
  const got = (await query(page, 'campaign.get', place)) as { directions: { id: string }[] }
  const post = {
    projectId: place.projectId,
    directionId: got.directions[0]!.id,
    sizeLabel: '1080x1080',
  }
  await command(page, 'variant.add', { ...post, language: 'de', format: 'image' })
  const read = (await query(page, 'translation.forCampaign', place)) as {
    rows: { layerId: string; language: string }[]
  }
  const rows = read.rows.filter((row) => row.language === 'de').slice(0, -1)
  for (const [i, row] of rows.entries()) {
    const input = {
      layerId: row.layerId,
      text: GERMAN[i % GERMAN.length]!,
      applyToSameLanguage: false,
    }
    await command(page, 'translation.set', { projectId: place.projectId, ...input })
  }
}

test('translation rows show their source beside the field, side by side and stacked', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { page } = session
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  const place = await makeCampaign(page)
  await translate(page, place)

  await showCampaignView(page, 'Translations')
  const german = page.getByRole('region', { name: /^German · / })
  await expect(german.getByText('English (source)').first()).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '350-translation-rows-with-source')

  // Narrower than the app's 900-wide window: the pair stacks only below two 320 columns.
  await page.setViewportSize({ width: 680, height: 1000 })
  const first = german.getByRole('listitem').first()
  await expect(first.getByRole('textbox')).toBeVisible()
  const source = await first.getByText('English (source)').boundingBox()
  const field = await first.getByRole('textbox').boundingBox()
  expect(field!.y).toBeGreaterThan(source!.y + source!.height)
  await page.waitForTimeout(300)
  fs.mkdirSync('shots', { recursive: true })
  await page.screenshot({ path: path.join('shots', '351-translation-narrow-stacked.png') })
})
