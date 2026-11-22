// R2C-3 (spec/phases/round-2-campaign.md, design addition 3): select, then open. 347: one click
// on the German square post selects it; no tab opens (CAMP-7: the line naming it is gone).
// 348: Down then Left move the selection to the English story post. 349: a double-click opens
// that post in the editor. Made-up names only; only the fake provider runs.
import { test, expect, type Page } from '@playwright/test'
import { command, query } from '../e2e/render-helpers'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

const PROJECT = 'Tidewater Coffee'
const CAMPAIGN = 'Harbour Blend'
const SIZES = [
  { label: '1080x1080', width: 1080, height: 1080 },
  { label: '1080x1920', width: 1080, height: 1920 },
]
const LANGUAGES = ['en', 'de']

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

async function makeCampaign(page: Page): Promise<void> {
  await screens.createProject(page, PROJECT)
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  const { projectId } = state.openProjects[0]!
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
    languages: LANGUAGES,
    sizes: SIZES,
    templateId: 'starter',
  })) as { campaignId: string }
  const got = (await query(page, 'campaign.get', { projectId, campaignId })) as {
    directions: { id: string }[]
  }
  const directionId = got.directions[0]!.id
  for (const size of SIZES) {
    for (const language of LANGUAGES) {
      if (size.label === '1080x1080' && language === 'en') continue
      const post = { projectId, directionId, sizeLabel: size.label, language }
      await command(page, 'variant.add', { ...post, format: 'image' })
    }
  }
}

test('select a post, move the selection, open it', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { page } = session
  await makeCampaign(page)
  await page.getByRole('button', { name: `Open ${CAMPAIGN}` }).click()
  const list = page.getByRole('list', { name: /^Variants in / })
  await expect(list.getByRole('listitem')).toHaveCount(4)
  const post = (line: string) => list.getByRole('button', { name: new RegExp(line) })
  const germanSquare = post('1080×1080 · de · image')
  const englishStory = post('1080×1920 · en · image')
  await page.waitForTimeout(500)

  await germanSquare.click()
  await expect(germanSquare).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('tablist', { name: 'Open variants' }).getByRole('tab')).toHaveCount(1)
  await shot(page, '347-tile-selected-not-open')

  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowLeft')
  await expect(englishStory).toBeFocused()
  await expect(englishStory).toHaveAttribute('aria-pressed', 'true')

  await shot(page, '348-selection-moved-by-arrows')

  await englishStory.dblclick()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
  await page.waitForTimeout(500)
  await shot(page, '349-variant-opened-by-double-click')
})
