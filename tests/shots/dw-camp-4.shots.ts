// CAMP-4 (spec/phases/design-wave-screens-b.md, "CAMP-4 — Checks tab"): 465, the check table
// with one warned row open and one post changed since its check; 466, the Rules section open
// with colours, the file tiles' "+" and word lists. A campaign of three sizes in English; the
// rules and the edits go through window.api. Fake providers only, nothing is paid and nothing
// leaves the machine. Made-up names only.
import { test, expect, type Page } from '@playwright/test'
import { showCampaignView } from '../e2e/campaign-view-steps'
import * as l from '../e2e/localize-steps'
import { command, query } from '../e2e/render-helpers'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

const CAMPAIGN = 'Juniper Ridge Cider'

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

type Layer = { id: string; type: string; copy: string | null }

async function textLayer(page: Page, projectId: string, variantId: string) {
  const read = (await query(page, 'variant.get', { projectId, variantId })) as { layers: Layer[] }
  const text = read.layers.find((x) => x.type === 'text' && (x.copy ?? '').trim() !== '')
  if (text === undefined) throw new Error('The post has no text layer with copy.')
  return text
}

async function setUp(page: Page) {
  await screens.createProject(page, 'Juniper Ridge')
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  const projectId = state.openProjects[0]!.projectId
  const { campaignId } = (await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: CAMPAIGN,
      region: 'US',
      audience: 'Friends at an autumn picnic',
      message: 'Crisp cider from the ridge',
      callToAction: 'Pour a glass',
      subjects: [{ name: 'Bottle' }],
    },
    subjectMap: [{ subjectId: 'bottle', create: true }],
    languages: ['en'],
    sizes: [
      { label: '1080x1080', width: 1080, height: 1080 },
      { label: '1080x1920', width: 1080, height: 1920 },
      { label: '1920x1080', width: 1920, height: 1080 },
    ],
    templateId: 'starter',
  })) as { campaignId: string }
  const first = (await query(page, 'campaign.get', { projectId, campaignId })) as {
    directions: { id: string }[]
    variants: { id: string }[]
  }
  const master = await textLayer(page, projectId, first.variants[0]!.id)
  const word = (master.copy ?? '').split(/\s+/)[0] ?? ''
  await command(page, 'variant.fanOut', {
    projectId,
    directionId: first.directions[0]!.id,
    sizes: ['1080x1920', '1920x1080'],
    languages: ['en'],
    formats: ['image'],
    fits: { '1080x1920': 'scale', '1920x1080': 'scale' },
  })
  await command(page, 'ruleSet.update', {
    projectId,
    campaignId,
    palette: ['#1A2B3C', '#F4E9D8', '#C8553D'],
    requiredWords: { en: ['Juniper Ridge'] },
    prohibitedWords: { en: [word, 'cheap'] },
  })
  return { projectId, campaignId }
}

test('465 the check table with a warned row open; 466 the Rules section', async () => {
  test.setTimeout(240_000)
  session = await openApp()
  const { page } = session
  await still(page)
  const { projectId, campaignId } = await setUp(page)
  await page.getByRole('button', { name: `Open ${CAMPAIGN}` }).click()
  await expect(page.getByRole('heading', { name: CAMPAIGN, level: 2 })).toBeVisible()
  await showCampaignView(page, 'Checks')

  const checks = l.checks(page)
  const run = checks.getByRole('button', { name: 'Run checks', exact: true })
  await run.click()
  await expect(run).toBeEnabled({ timeout: 60_000 })
  await expect(checks.getByRole('rowgroup')).toHaveCount(4, { timeout: 60_000 })

  // One post changed after its check.
  const read = (await query(page, 'campaign.get', { projectId, campaignId })) as {
    variants: { id: string; isMaster: boolean }[]
  }
  const last = read.variants.filter((x) => !x.isMaster).at(-1)!
  const text = await textLayer(page, projectId, last.id)
  await command(page, 'layer.update', {
    projectId,
    layerId: text.id,
    patch: { copy: `${text.copy ?? ''} tonight` },
  })
  await expect(checks.getByRole('button', { name: /^1 not checked/ })).toBeVisible()

  await checks.getByRole('button', { name: /^\d+ warnings?\b/ }).click()
  await expect(checks.getByRole('button', { expanded: true })).toHaveCount(1)
  await page.mouse.move(0, 0)
  await shot(page, '465-check-table-row-open')

  const rules = await l.openRules(page)
  await rules.scrollIntoViewIfNeeded()
  await expect(rules.getByRole('list', { name: 'Colours' }).getByRole('listitem')).toHaveCount(3)
  await shot(page, '466-check-rules-open')
})
