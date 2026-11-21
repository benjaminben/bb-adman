// P3-13: the properties panel. The campaign comes from the S2-16 brief, with a three-colour
// palette set on its rule set. Then: the panel for the selected headline (every text field),
// the panel for the headline once locked, and the panel for the background.
import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { command } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

const BRIEF = path.resolve('tests/shots/fixtures/s2-16-brief.yaml')
const PALETTE = ['#1F6FB2', '#E8F4FA', '#F2A541']

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

type Layer = { id: string; type: string; name: string }

async function query(page: Page, name: string, input: unknown): Promise<Record<string, unknown>> {
  return page.evaluate(
    async ([n, i]) => {
      const api = (
        window as unknown as { api: { query: (n: string, i: unknown) => Promise<unknown> } }
      ).api
      return ((await api.query(n, i)) as { data: Record<string, unknown> }).data
    },
    [name, input] as const,
  )
}

async function ids(page: Page) {
  const state = await query(page, 'app.getState', {})
  const projectId = (state.openProjects as { projectId: string }[])[0]!.projectId
  const project = await query(page, 'project.get', { projectId })
  const campaignId = (project.campaigns as { id: string }[])[0]!.id
  const campaign = await query(page, 'campaign.get', { projectId, campaignId })
  const variantId = (campaign.variants as { id: string }[])[0]!.id
  const variant = await query(page, 'variant.get', { projectId, variantId })
  return { projectId, campaignId, layers: variant.layers as Layer[] }
}

const panel = (page: Page) => page.getByRole('region', { name: 'Properties' })

test('The properties panel', async () => {
  session = await openApp()
  const { app, page } = session
  await screens.createProject(page, 'Alpine Spring')
  await screens.answerOpenDialog(app, [BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  await page
    .getByRole('region', { name: 'Brief' })
    .getByRole('button', { name: 'Create campaign' })
    .click()
  await expect(page.getByRole('list', { name: 'Variants' }).getByRole('button')).toHaveCount(1)

  const { projectId, campaignId, layers } = await ids(page)
  await command(page, 'ruleSet.update', { projectId, campaignId, palette: PALETTE })
  const headline = layers.find((l) => l.type === 'text' && l.name === 'Headline')!
  const background = layers.find((l) => l.type === 'background')!

  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().click()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
  await page.getByRole('button', { name: new RegExp(`^${headline.name}`) }).click()
  await expect(
    panel(page).getByRole('button', { name: `Palette colour ${PALETTE[0]}` }),
  ).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '55-properties-text-layer')

  await panel(page).getByRole('checkbox', { name: 'Locked' }).click()
  await expect(panel(page).getByRole('textbox', { name: 'Copy' })).toBeDisabled()
  await page.waitForTimeout(300)
  await shot(page, '56-properties-locked-layer')

  await page.getByRole('button', { name: new RegExp(`^${background.name}`) }).click()
  await expect(panel(page).getByRole('heading', { name: background.name })).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '57-properties-background')
})
