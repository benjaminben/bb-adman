// The steps of workflow 5.1 (REQUIREMENTS.md) through the built app's screens, for
// workflow-5-1.spec.ts and the P4-20 shots (P4-20). Every step is a click or a typed value, as
// the user does it; only the native file dialog is answered in the main process (screens.ts).
// Every provider is the fake one unless a step says so. Not a test file itself.
import { expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import path from 'node:path'
import * as screens from './screens'
import { query } from './render-helpers'

// The made-up Markdown brief of P4-15; the fake provider reads its `Label: value` lines.
export const MD_BRIEF = path.resolve('tests/fixtures/briefs/p4-15-brief.md')
export const MD_PHOTO = path.resolve('tests/fixtures/briefs/photos/berry-bottle.png')
export const READ_NAME = 'Harbour Lights'
export const CAMPAIGN = 'Harbour Lights at Dusk'
export const MESSAGE = 'Long evenings, bright lanterns'

// A run dialog closes when its command answers; on a busy machine that can pass 5 s.
export const CLOSES = { timeout: 15_000 }

export type Layer = {
  id: string
  type: string
  name: string
  slot: string | null
  copy: string | null
  source: { assetId: string } | null
}

export type Place = { projectId: string; campaignId: string; variantId: string }

// The shown project's campaign of that name and its first variant.
export async function placeOf(page: Page, name: string): Promise<Place> {
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  const projectId = state.openProjects[0]!.projectId
  const project = (await query(page, 'project.get', { projectId })) as {
    campaigns: { id: string; name: string }[]
  }
  const campaignId = project.campaigns.find((c) => c.name === name)!.id
  const campaign = (await query(page, 'campaign.get', { projectId, campaignId })) as {
    variants: { id: string }[]
  }
  return { projectId, campaignId, variantId: campaign.variants[0]!.id }
}

export async function layersOf(page: Page, place: Place): Promise<Layer[]> {
  const { projectId, variantId } = place
  const got = (await query(page, 'variant.get', { projectId, variantId })) as { layers: Layer[] }
  return got.layers
}

// Steps 1 to 3: load the Markdown brief, read it with AI, correct the name, add a photo, create
// the campaign.
export async function readBriefAndCreate(app: ElectronApplication, page: Page): Promise<void> {
  await screens.answerOpenDialog(app, [MD_BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  const run = page.getByRole('dialog', { name: 'Read the brief with AI' })
  await run.getByRole('radio', { name: 'Fake provider' }).check()
  await run.getByRole('button', { name: 'Read brief' }).click()
  const form = page.getByRole('region', { name: 'Brief' })
  const name = form.getByLabel('Campaign name')
  await expect(name).toHaveValue(READ_NAME, { timeout: 15_000 })
  await expect(form.getByLabel('Message')).toHaveValue(MESSAGE)
  await name.fill(CAMPAIGN)
  // SP-5: a Markdown brief names no photo; the subject needs one before Create. Not the test
  // brief's photo: one picture belongs to one subject, and runs load both briefs in one project.
  await screens.addPhoto(app, form, 1, MD_PHOTO)
  await form.getByRole('button', { name: 'Create campaign' }).click()
  await expect(page.getByRole('heading', { name: CAMPAIGN, level: 2 })).toBeVisible()
}

// Step 4: the master variant in the editor.
export async function openMaster(page: Page): Promise<void> {
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().dblclick()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
}

export async function selectLayer(page: Page, name: string): Promise<void> {
  const rows = page.getByRole('list', { name: 'Layers' })
  await rows.getByRole('button', { name: new RegExp(`^${name}`) }).click()
}

export const pictureSection = (page: Page): Locator => page.getByRole('group', { name: 'Generate' })
export const earlierOptions = (page: Page): Locator =>
  page.getByRole('region', { name: 'Earlier options' })

// Step 5: Generate… opens the run dialog, which shows the count and the provider; the user
// changes the provider to the fake one, which makes `count` pictures.
export async function makePictures(page: Page, count: number): Promise<void> {
  await pictureSection(page).getByRole('button', { name: 'Generate…' }).click()
  const run = page.getByRole('dialog', { name: 'Make pictures' })
  await run.getByRole('spinbutton', { name: 'Pictures' }).fill(String(count))
  await run.getByRole('radio', { name: 'Google Gemini' }).check()
  await expect(run).toContainText(`Paid: ${count} picture${count === 1 ? '' : 's'}`)
  await expect(run).toContainText('to Google Gemini')
  await run.getByRole('radio', { name: 'Fake provider' }).check()
  await expect(run).toContainText('This uses the fake provider. Nothing is charged.')
  await run.getByRole('button', { name: 'Generate' }).click()
  await expect(run).toBeHidden(CLOSES)
  await expect(
    pictureSection(page).getByText(
      'Done. The first new picture is on the layer. Click another below to use it instead.',
    ),
  ).toBeVisible({ timeout: 20_000 })
}

// Step 5: picks option `n` of the newest run.
export async function useOption(page: Page, n: number): Promise<void> {
  const section = earlierOptions(page)
  await section
    .getByRole('button', { name: new RegExp(`^Use option ${n} from `) })
    .first()
    .click()
  await expect(section.getByText('In use')).toBeVisible()
}

// Step 6: the layout from the fake provider.
export async function placeText(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Place text with AI…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Place text with AI' })
  await dialog.getByRole('radio', { name: 'Fake provider' }).check()
  await dialog.getByRole('button', { name: 'Place text' }).click()
  await expect(dialog).toHaveCount(0, CLOSES)
  await expect(page.getByText('Placing text with AI…')).toHaveCount(0, { timeout: 15_000 })
}

// Step 7: copy options for a text layer, and the chosen line used.
export async function suggestAndUse(page: Page, layer: string, line: string): Promise<void> {
  await selectLayer(page, layer)
  const panel = page.getByRole('region', { name: 'Properties' })
  await panel.getByRole('button', { name: 'Suggest copy…' }).click()
  const dialog = page.getByRole('dialog', { name: `Copy options for ${layer}` })
  // DLG-4b: with no options yet the run setup shows inside the dialog at once; otherwise
  // "New options" (named "Make new options…") shows it.
  const generate = dialog.getByRole('button', { name: 'Generate' })
  const newOptions = dialog.getByRole('button', { name: 'Make new options…' })
  await expect(generate.or(newOptions)).toBeVisible()
  if (!(await generate.isVisible())) await newOptions.click()
  await dialog.getByRole('radio', { name: 'Fake provider' }).check()
  await expect(dialog.getByText('This uses the fake provider. Nothing is charged.')).toBeVisible()
  await generate.click()
  await expect(generate).toHaveCount(0, CLOSES)
  await dialog.getByRole('radio', { name: line }).check()
  await dialog.getByRole('button', { name: 'Use', exact: true }).click()
}

// Step 7: the cut-out of the selected picture layer, through its run dialog.
export async function cutOut(page: Page): Promise<void> {
  const fields = page.getByRole('group', { name: 'Picture' })
  await fields.getByRole('button', { name: 'Cut out the subject…' }).click()
  const run = page.getByRole('dialog', { name: 'Cut out the subject' })
  await run.getByRole('radio', { name: 'Fake provider' }).check()
  await run.getByRole('button', { name: 'Cut out' }).click()
  await expect(run).toBeHidden(CLOSES)
  await expect(fields.getByText('Done. The cut-out is under Earlier options.')).toBeVisible({
    timeout: 20_000,
  })
}
