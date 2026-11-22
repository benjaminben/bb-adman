// P6-11: the check panel on the campaign overview, master only. 202: every check passes or is
// skipped. 203: a prohibited "!" and a palette without the headline's colour give two
// warnings. 204: an edit after the check marks the block "Changed since the last check.".
// The rule set and the edit go through window.api, since the rule set panel is its own slice.
import { test, expect, type Page } from '@playwright/test'
import { showCampaignView } from '../e2e/campaign-view-steps'
import * as screens from '../e2e/screens'
import { command, query } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

type Layer = { id: string; type: string; copy: string | null; style: { color?: string } }

// The open project, its one campaign and the master's text layer with copy.
async function ids(page: Page) {
  const state = (await query(page, 'app.getState', undefined)) as {
    openProjects: Array<{ projectId: string }>
  }
  const projectId = state.openProjects[0]?.projectId ?? ''
  const project = (await query(page, 'project.get', { projectId })) as {
    campaigns: Array<{ id: string }>
  }
  const campaignId = project.campaigns[0]?.id ?? ''
  const campaign = (await query(page, 'campaign.get', { projectId, campaignId })) as {
    variants: Array<{ id: string; isMaster: boolean }>
  }
  const variantId = campaign.variants.find((v) => v.isMaster)?.id ?? ''
  const variant = (await query(page, 'variant.get', { projectId, variantId })) as {
    layers: Layer[]
  }
  const text = variant.layers.find((l) => l.type === 'text' && (l.copy ?? '').trim() !== '')
  if (text === undefined) throw new Error('The master has no text layer with copy.')
  return { projectId, campaignId, text }
}

const checks = (page: Page) => page.getByRole('region', { name: 'Checks' })

async function runChecks(page: Page) {
  await showCampaignView(page, 'Checks')
  await checks(page).getByRole('button', { name: 'Run checks' }).click()
  await expect(checks(page).getByText('Checking…')).toHaveCount(0)
}

test('the check panel: passed, two warnings, then stale after an edit', async () => {
  session = await openApp()
  const { app, page } = session
  await screens.createProject(page, 'Harbour Lemonade')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  const { projectId, campaignId, text } = await ids(page)
  const copy = text.copy ?? ''

  await command(page, 'ruleSet.update', {
    projectId,
    campaignId,
    requiredWords: { en: [copy.split(/\s+/)[0] ?? copy] },
  })
  await runChecks(page)
  await expect(checks(page).getByText(/^1 post checked · 0 with/)).toBeVisible()
  await expect(checks(page).getByText(/: Warning$/)).toHaveCount(0)
  await shot(page, '202-check-panel-passed')

  await command(page, 'ruleSet.update', {
    projectId,
    campaignId,
    palette: ['#1A2B3C'],
    prohibitedWords: { en: ['!'] },
  })
  await command(page, 'layer.update', { projectId, layerId: text.id, patch: { copy: `${copy}!` } })
  await runChecks(page)
  await expect(checks(page).getByText('Prohibited words: Warning')).toBeVisible()
  await expect(checks(page).getByText('Text colours: Warning')).toBeVisible()
  await shot(page, '203-check-panel-warnings')

  await command(page, 'layer.update', { projectId, layerId: text.id, patch: { copy } })
  await expect(checks(page).getByText('Changed since the last check.')).toBeVisible()
  await expect(checks(page).getByText(/1 not checked since a change$/)).toBeVisible()
  await shot(page, '204-check-panel-stale')
})
