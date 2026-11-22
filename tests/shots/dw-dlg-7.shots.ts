// DLG-7 (spec/phases/design-wave-screens-b.md, "DLG-7 — Review dialogs"): 489, the sync
// review with an override on the picked variant; 490, a report with the second ad picked;
// 491, quick look. Fake providers only, nothing paid and nothing leaves the machine; the
// export goes to a folder inside the sandbox. Made-up names only.
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import * as v from '../e2e/variants-steps'
import * as ex from '../e2e/export-steps'
import { command, query } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

const DIRECTION = 'Direction 1'
const TALL = '9x16 (1080×1920)'
const WIDE = '16x9 (1920×1080)'
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

test('489 the sync review with an override', async () => {
  test.setTimeout(240_000)
  session = await openApp()
  const { app, page } = session
  await still(page)
  await screens.createProject(page, 'Tidewater Coffee')
  await v.createFromForm(app, page, { languages: 'en, de', sizes: [WIDE] })
  await v.fanOut(page, DIRECTION, { sizes: [TALL, WIDE] })
  await v.fanOut(page, DIRECTION, { languages: ['de'] })
  await expect(v.grid(page, DIRECTION).getByRole('listitem')).toHaveCount(4)

  // The tall variant's headline colour by hand, then the master's colour and copy.
  await v.editLayer(page, v.tile(page, DIRECTION, '1080×1920 · en'), 'Headline')
  await v.setColour(page, '#C2185B')
  await v.showOverview(page)
  await v.editLayer(page, v.tile(page, DIRECTION, '· master'), 'Headline')
  await v.setColour(page, '#1F6FEB')
  await v.setCopy(page, 'Slow mornings, dark roast')
  await v.showOverview(page)
  await expect(v.outOfDate(page, DIRECTION)).toHaveCount(3)

  const review = await v.openSyncReview(page, DIRECTION, 3)
  await review.getByRole('button', { name: /· 9x16 · en$/ }).click()
  const flag = 'Changed on this variant: style: colour'
  await expect(review.getByRole('radiogroup', { name: flag })).toBeVisible()
  await review.getByRole('checkbox').first().check()
  await expect(review.getByText('Slow mornings, dark roast')).toBeVisible()
  await shot(page, '489-sync-review-override')
})

async function exportedCampaign(page: Page, root: string) {
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
      audience: 'Commuters who like a warm cup',
      message: 'Slow down with a cup at dusk',
      callToAction: 'Try a cup today',
      subjects: [{ name: 'Tea tin' }],
    },
    subjectMap: [{ subjectId: 'tea-tin', create: true }],
    languages: ['en', 'de'],
    sizes: [
      { label: '1080x1080', width: 1080, height: 1080 },
      { label: '1080x1920', width: 1080, height: 1920 },
    ],
    templateId: 'starter',
  })) as { campaignId: string }
  const read = (await query(page, 'campaign.get', { projectId, campaignId })) as {
    directions: { id: string }[]
  }
  await command(page, 'variant.fanOut', {
    projectId,
    directionId: read.directions[0]!.id,
    sizes: ['1080x1080', '1080x1920'],
    languages: ['en', 'de'],
    formats: ['image'],
    fits: { '1080x1920': 'scale' },
  })
  const all = (await query(page, 'campaign.get', { projectId, campaignId })) as {
    variants: { id: string }[]
  }
  const folder = ex.outputFolder(root, 'Harbour Lights handover')
  const ids = all.variants.map((r) => r.id)
  const ended = await ex.exportByApi(page, { projectId, campaignId }, ids, folder, {
    proceedDespiteWarnings: true,
  })
  expect(ended.status).toBe('succeeded')
}

test('490 a report and 491 quick look', async () => {
  test.setTimeout(300_000)
  session = await openApp()
  const { page } = session
  await still(page)
  await exportedCampaign(page, session.box.root)
  await page.getByRole('button', { name: `Open ${CAMPAIGN}` }).click()
  await expect(page.getByRole('heading', { name: CAMPAIGN, level: 2 })).toBeVisible()

  await page.getByRole('button', { name: `More actions for ${CAMPAIGN}` }).click()
  await page.getByRole('menuitem', { name: 'Reports…' }).click()
  const reports = page.getByRole('dialog', { name: 'Reports' })
  await reports.getByRole('button', { name: /^Export 1/ }).click()
  const view = page.getByRole('dialog', { name: 'Export report' })
  const ads = view.getByRole('list', { name: 'Ads' })
  await expect(ads.getByRole('listitem')).toHaveCount(4)
  await ads.getByRole('button').nth(1).click()
  await expect(view.locator('img')).toHaveCount(4)
  await shot(page, '490-report-view')
  await view.getByRole('button', { name: 'Close' }).click()
  await expect(view).toBeHidden()
  if (await reports.isVisible()) await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page
    .getByRole('button', { name: /^Quick look at / })
    .first()
    .click()
  const look = page.getByRole('dialog')
  const img = look.locator('img')
  await expect(img).toHaveCount(1)
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0)
  await expect(look.getByText('1 / 4')).toBeVisible()
  await shot(page, '491-quick-look')
})
