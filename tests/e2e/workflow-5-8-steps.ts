// Workflow 5.8 steps 1 to 3 (REQUIREMENTS.md) for workflow-5-1.spec.ts (P4-20): two campaigns,
// a Gemini picture run for the first one's background confirmed through the run dialog and held
// running by gemini-answers.ts (made-up key, nothing leaves the computer), then the second
// campaign opened in its own tab. Not a test file itself.
import { expect, type ElectronApplication, type Page } from '@playwright/test'
import * as screens from './screens'
import { MADE_UP_KEY } from './gemini-stand-in'
import { answerGemini, heldCount, installGemini } from './gemini-answers'
import { command } from './render-helpers'
import * as w from './workflow-5-1-steps'

export async function runLeftGoing(app: ElectronApplication, page: Page): Promise<w.Place> {
  await installGemini(app)
  await answerGemini(app, 'hold')
  await command(page, 'secret.set', { name: 'gemini.apiKey', value: MADE_UP_KEY })
  await screens.createProject(page, 'Harbour')
  await w.readBriefAndCreate(app, page)
  await page.getByRole('tab', { name: 'Project' }).click()
  await screens.loadBriefAndCreate(app, page)
  const place = await w.placeOf(page, w.CAMPAIGN)

  // Steps 1 and 2: the run confirmed; the dialog closes and the run goes on.
  await page.getByRole('button', { name: `Open ${w.CAMPAIGN}` }).click()
  await w.openMaster(page)
  const background = (await w.layersOf(page, place)).find((l) => l.type === 'background')!
  await w.selectLayer(page, background.name)
  await w.pictureSection(page).getByRole('button', { name: 'Generate…' }).click()
  const run = page.getByRole('dialog', { name: 'Make pictures' })
  await run.getByRole('spinbutton', { name: 'Pictures' }).fill('1')
  await run.getByRole('radio', { name: 'Google Gemini' }).check()
  await run.getByRole('button', { name: 'Generate' }).click()
  await expect(run).toBeHidden()
  await expect.poll(() => heldCount(app)).toBe(1)

  // Step 3: the other campaign, in its own tab.
  await page.getByRole('tab', { name: 'Project' }).click()
  await screens.openCampaign(page)
  return place
}

export const campaignTab = (page: Page, name: string) =>
  page.getByRole('tablist', { name: 'Open campaigns' }).getByRole('tab', {
    name: new RegExp(`^${name}`),
  })

export const activityButton = (page: Page) => page.getByRole('button', { name: /^Activity/ })
