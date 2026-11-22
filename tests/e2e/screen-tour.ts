// The rows of the 1.56 reach table that are not ComfyUI's: Settings, the Start screen and the
// project home, through their screens, for the offline spec. Everything stays in the sandbox
// folders. Not a test file itself.
import { expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import type { Sandbox } from './launch'
import * as screens from './screens'

export async function settingsTour(app: ElectronApplication, page: Page, box: Sandbox) {
  const elsewhere = path.join(box.root, 'elsewhere')
  fs.mkdirSync(elsewhere)
  await screens.openSettingsPage(page, 'Files')
  await screens.answerOpenDialog(app, [elsewhere])
  await page.getByRole('button', { name: 'Change default location' }).click()
  await expect(page.getByText(elsewhere, { exact: true })).toBeVisible()
  await screens.chooseSettingsPage(page, 'AI services')

  const row = page.getByRole('group', { name: 'Google Gemini API key' })
  await row.getByRole('button', { name: 'Add' }).click()
  await row.getByLabel('New Google Gemini API key').fill('e2e-made-up-value-ABCD')
  await row.getByRole('button', { name: 'Save' }).click()
  await expect(row.getByText('Saved, ends in ABCD')).toBeVisible()
  await row.getByRole('button', { name: 'Replace' }).click()
  await row.getByRole('button', { name: 'Cancel' }).click()
  await expect(row.getByText('Saved, ends in ABCD')).toBeVisible()
  await row.getByRole('button', { name: 'Delete' }).click()
  await expect(row.getByText('Not set')).toBeVisible()

  const image = page.getByLabel('Image generation')
  await image.selectOption({ label: 'ComfyUI' })
  await expect(image).toHaveValue('comfyui')
}

// Change location, Create, Close, Open project…, Recent projects, then the project home.
export async function startTour(app: ElectronApplication, page: Page, box: Sandbox) {
  const other = path.join(box.root, 'other')
  fs.mkdirSync(other)
  await screens.showStart(page)
  await screens.answerOpenDialog(app, [other])
  await page.getByRole('button', { name: 'Change location' }).click()
  await expect(page.getByText(other, { exact: true })).toBeVisible()
  await screens.createProject(page, 'Gamma')
  const file = path.join(other, 'Gamma.adman')
  expect(fs.existsSync(file)).toBe(true)

  const close = () => page.getByRole('button', { name: 'Close Gamma' }).click()
  await close()
  await expect(page.getByRole('button', { name: 'Gamma', exact: true })).toHaveCount(0)
  await screens.answerOpenDialog(app, [file])
  await page.getByRole('button', { name: 'Open project…' }).click()
  await expect(page.getByRole('heading', { name: 'Gamma', level: 1 })).toBeVisible()
  await close()
  await page.getByRole('button', { name: /^Open Gamma/ }).click()
  await expect(page.getByRole('heading', { name: 'Gamma', level: 1 })).toBeVisible()
}

export async function projectHomeTour(app: ElectronApplication, page: Page) {
  await screens.answerOpenDialog(app, [screens.E2E_BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  await page.getByRole('region', { name: 'Brief' }).getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('button', { name: 'Load a brief' })).toBeVisible()

  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  // campaign.create makes the master variant only, and no screen adds another yet, so the
  // choice is between one: it is chosen at the start, opens in the editor when double-clicked (P3-9),
  // and stays chosen back on the overview.
  const variants = page
    .getByRole('list', { name: 'Variants' })
    .getByRole('button', { name: /^(?!Open |Quick look at |Delete )/ })
  await expect(variants).toHaveCount(1)
  await expect(variants.first()).toHaveAttribute('aria-pressed', 'true')
  await variants.first().dblclick()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
  await page.getByRole('tab', { name: 'Overview' }).click()
  await expect(variants.first()).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Back to project' }).click()
  await expect(page.getByRole('list', { name: 'Campaigns' })).toBeVisible()
}

// Settings · Agent runs (spec/agent-runs.md, "Settings block"): one tick per offered provider,
// and the limit, each saved to settings.json. Clicks only: no agent and no run.
export async function agentRunsTour(page: Page, box: Sandbox) {
  const saved = () => JSON.parse(fs.readFileSync(path.join(box.userData, 'settings.json'), 'utf8'))
  await screens.openSettingsPage(page, 'Agents')
  const block = page.getByRole('region', { name: 'Agent runs' })
  const tick = (label: string) =>
    block.getByRole('checkbox', { name: `Let agents start runs with ${label}` })
  for (const label of ['ComfyUI', 'Fake provider', 'fal.ai Seedance'])
    await expect(tick(label)).toHaveCount(1)
  await expect(tick('Adobe Firefly')).toHaveCount(0)

  await tick('ComfyUI').check()
  await expect(tick('ComfyUI')).toBeChecked()
  await expect(tick('Fake provider')).not.toBeChecked()
  await expect.poll(() => saved().agentRuns).toEqual({ comfyui: { allowed: true } })

  const limit = block.getByLabel('Most runs agents may have waiting or running, per provider')
  await expect(limit).toHaveValue('4')
  await limit.fill('9')
  await expect.poll(() => saved().agentRunLimit).toBe(9)

  await tick('ComfyUI').uncheck()
  await expect.poll(() => saved().agentRuns).toEqual({ comfyui: { allowed: false } })
}

// P4-20: the picture section of a picture layer (spec/screens-ai.md, "The picture section of the
// properties panel") and the Activity button and panel ("The activity panel"). Clicks only: the
// run dialog is cancelled, so no run starts.
export async function aiTour(app: ElectronApplication, page: Page) {
  await screens.createProject(page, 'Delta')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().dblclick()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
  await page.getByRole('button', { name: 'Add picture layer' }).click()
  const section = page.getByRole('group', { name: 'Generate' })
  await expect(section.getByRole('button', { name: 'Choose reference pictures…' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Earlier options' })).toBeVisible()
  await section.getByRole('button', { name: 'Generate…' }).click()
  const run = page.getByRole('dialog', { name: 'Make pictures' })
  await expect(run.getByRole('radio', { name: 'Fake provider' })).toBeVisible()
  await run.getByRole('button', { name: 'Cancel' }).click()
  await expect(run).toBeHidden()

  await page.getByRole('button', { name: /^Activity/ }).click()
  const panel = page.getByRole('region', { name: 'Activity' })
  await expect(panel).toBeVisible()
  await panel.getByRole('button', { name: 'Close activity' }).click()
  await expect(panel).toBeHidden()
}

// P5-19: the campaign overview with two directions (spec/screens-variants.md, "The overview"):
// "New direction from this master…" named Studio, then one grid per direction. Clicks only.
export async function directionsTour(app: ElectronApplication, page: Page) {
  await screens.createProject(page, 'Epsilon')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  const first = page.getByRole('region', { name: 'Direction 1', exact: true })
  await first.getByRole('button', { name: 'Direction', exact: true }).click()
  await page.getByRole('menuitem', { name: 'New direction from this master…' }).click()
  const make = page.getByRole('dialog', { name: 'New direction' })
  await make.getByRole('textbox', { name: 'Name' }).fill('Studio')
  await make.getByRole('button', { name: 'Make direction' }).click()
  await expect(make).toBeHidden()
  const grids = page.getByRole('list', { name: /^Variants in / })
  await expect(grids).toHaveCount(2)
  for (const img of await grids.locator('img').all()) {
    await expect
      .poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth))
      .toBeGreaterThan(0)
  }
}
