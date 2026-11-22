// P4-17: copy options. The campaign comes from the S2-16 brief. In the editor, a text layer that
// is not the headline is selected: "Suggest copy…" sits beside its Copy field (88). Options are
// made with the fake provider (87). Then a Gemini run is held running (tests/e2e/held-run.ts:
// no request leaves the computer, the key is made up) and closing the dialog shows the close
// warning (71, owed by P4-10). The fake provider's wait cannot be set in the built app.
import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { holdGemini } from '../e2e/held-run'
import { MADE_UP_KEY } from '../e2e/gemini-stand-in'
import { answerQuit } from '../e2e/quit-answer'
import { command, query } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

const BRIEF = path.resolve('tests/shots/fixtures/s2-16-brief.yaml')

let session: Session | undefined

test.afterEach(async () => {
  if (session) await answerQuit(session.app)
  await closeApp(session)
  session = undefined
})

type Layer = { id: string; type: string; name: string; slot: string | null }

async function textLayer(page: Page): Promise<Layer> {
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
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
    layers: Layer[]
  }
  return variant.layers.find((l) => l.type === 'text' && l.slot !== 'headline')!
}

const panel = (page: Page) => page.getByRole('region', { name: 'Properties' })

async function makeOptions(page: Page, provider: string) {
  await page.getByRole('button', { name: 'Make new options…' }).click()
  const run = page.getByRole('dialog', { name: 'Suggest copy' })
  await run.getByRole('radio', { name: provider }).check()
  await run.getByRole('button', { name: 'Suggest copy' }).click()
  await expect(run).toHaveCount(0)
}

test('Copy options for a text layer', async () => {
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
  const layer = await textLayer(page)

  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().dblclick()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
  await page.getByRole('button', { name: new RegExp(`^${layer.name}`) }).click()
  const suggest = panel(page).getByRole('button', { name: 'Suggest copy…' })
  await expect(suggest).toBeEnabled()
  await page.waitForTimeout(300)
  await shot(page, '88-suggest-copy-button')

  await suggest.click()
  const dialog = page.getByRole('dialog', { name: `Copy options for ${layer.name}` })
  await expect(dialog).toBeVisible()
  await makeOptions(page, 'Fake provider')
  await expect(dialog.getByRole('button', { name: 'Use this text' }).first()).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '87-copy-options')

  await command(page, 'secret.set', { name: 'gemini.apiKey', value: MADE_UP_KEY })
  await holdGemini(app)
  await makeOptions(page, 'Google Gemini')
  await expect(dialog.getByText('Writing options…')).toBeVisible()
  await dialog.getByRole('button', { name: 'Close' }).click()
  const warning = page.getByRole('dialog', { name: 'Stop writing copy options?' })
  await expect(warning).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '71-close-warning-dialog')

  await warning.getByRole('button', { name: 'Stop and close' }).click()
  await expect(dialog).toHaveCount(0)
})
