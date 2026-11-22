// ST-10: the activity panel and the copy options dialog in the new look. 195: the panel with a
// running row, a finished row and a failed row, each with its status badge. The Gemini runs go to
// the stand-in of p4-14-gemini.ts (no request leaves the computer, the key is made up): one is
// refused, one is held running. 196: copy options made with the fake provider, as P4-17.
import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { MADE_UP_KEY } from '../e2e/gemini-stand-in'
import { answerQuit } from '../e2e/quit-answer'
import { command, query } from '../e2e/render-helpers'
import { holdGemini, installGemini, releaseGemini } from './p4-14-gemini'
import { closeApp, openApp, shot, type Session } from './shot'

const BRIEF = path.resolve('tests/shots/fixtures/s2-16-brief.yaml')

let session: Session | undefined

test.afterEach(async () => {
  if (session) await answerQuit(session.app)
  await closeApp(session)
  session = undefined
})

// The name of the first variant's first text layer that is not the headline, as P4-17.
async function textLayerName(page: Page): Promise<string> {
  const state = (await query(page, 'app.getState', {})) as { openProjects: { projectId: string }[] }
  const projectId = state.openProjects[0]!.projectId
  const project = (await query(page, 'project.get', { projectId })) as {
    campaigns: { id: string }[]
  }
  const campaignId = project.campaigns[0]!.id
  const campaign = (await query(page, 'campaign.get', { projectId, campaignId })) as {
    variants: { id: string }[]
  }
  const variantId = campaign.variants[0]!.id
  const variant = (await query(page, 'variant.get', { projectId, variantId })) as {
    layers: { type: string; name: string; slot: string | null }[]
  }
  return variant.layers.find((l) => l.type === 'text' && l.slot !== 'headline')!.name
}

async function pictureRun(page: Page, provider: string) {
  await screens.setCount(page, 1)
  await screens.chooseProvider(page, provider)
  await screens.generate(page)
  if (provider !== 'Fake provider') {
    await screens.picturePanel(page).getByRole('button', { name: 'Confirm' }).click()
  }
}

test('The activity panel in the new look', async () => {
  session = await openApp()
  const { app, page } = session
  await installGemini(app)
  await screens.createProject(page, 'Summer Launch')
  await command(page, 'secret.set', { name: 'gemini.apiKey', value: MADE_UP_KEY })
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  await screens.chooseSlot(page)
  await screens.setPrompt(page, screens.E2E_PROMPT)

  await pictureRun(page, 'Google Gemini')
  await expect(screens.runRow(page)).toContainText('Failed')
  await pictureRun(page, 'Fake provider')
  await expect(screens.runRow(page)).toContainText('Done')
  await holdGemini(app)
  await pictureRun(page, 'Google Gemini')
  await expect(screens.runRow(page)).toContainText('Working')

  await page.getByRole('button', { name: /^Activity/ }).click()
  const panel = page.getByRole('region', { name: 'Activity' })
  await expect(panel.getByRole('heading', { name: 'Running' })).toBeVisible()
  await expect(panel.getByRole('heading', { name: 'Finished' })).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '195-activity-panel')
  await releaseGemini(app, 1, 'refuse')
})

test('The copy options dialog in the new look', async () => {
  session = await openApp()
  const { app, page } = session
  await screens.createProject(page, 'Alpine Spring')
  await screens.answerOpenDialog(app, [BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  await page
    .getByRole('region', { name: 'Brief' })
    .getByRole('button', { name: 'Create campaign' })
    .click()
  await expect(page.getByRole('list', { name: 'Variants' }).getByRole('listitem')).toHaveCount(1)
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().dblclick()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()

  const layer = await textLayerName(page)
  await page.getByRole('button', { name: new RegExp(`^${layer}`) }).click()
  await page
    .getByRole('region', { name: 'Properties' })
    .getByRole('button', { name: 'Suggest copy…' })
    .click()
  const dialog = page.getByRole('dialog', { name: /^Copy options for / })
  await dialog.getByRole('button', { name: 'Make new options…' }).click()
  const run = page.getByRole('dialog', { name: 'Suggest copy' })
  await run.getByRole('radio', { name: 'Fake provider' }).check()
  await run.getByRole('button', { name: 'Suggest copy' }).click()
  await expect(run).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Use this text' }).first()).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '196-copy-options')
})
