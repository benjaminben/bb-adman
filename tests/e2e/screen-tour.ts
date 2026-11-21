// The rows of the 1.56 reach table that are not ComfyUI's: the hand-test storage on this
// computer, Settings, the Start screen and the project home, through their screens, for the
// offline spec. Everything stays in the sandbox folders. Not a test file itself.
import { expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import type { Sandbox } from './launch'
import * as screens from './screens'

// The local hand-test folder (commands/dev/storage.ts): {userData}/hand-test-local.
function handTestFiles(box: Sandbox): string[] {
  const folder = path.join(box.userData, 'hand-test-local', 'adman-hand-test')
  return fs.existsSync(folder) ? fs.readdirSync(folder) : []
}

export async function handTestStorage(page: Page, box: Sandbox): Promise<void> {
  const file = path.join(box.root, 'hand-test.txt')
  fs.writeFileSync(file, 'hand test')
  await page.getByRole('button', { name: 'Hand test' }).click()
  await expect(page.getByRole('heading', { name: 'Hand test', level: 1 })).toBeVisible()
  await page.getByLabel('File to upload (full path)').fill(file)
  const done = () => expect(page.getByText('Working...')).toBeHidden()
  await page.getByRole('button', { name: 'Upload' }).click()
  await done()
  await expect.poll(() => handTestFiles(box).length).toBe(1)
  await page.getByRole('button', { name: 'List' }).click()
  await done()
  await page.getByRole('button', { name: 'Remove all' }).click()
  await done()
  await expect.poll(() => handTestFiles(box).length).toBe(0)
}

export async function settingsTour(app: ElectronApplication, page: Page, box: Sandbox) {
  const elsewhere = path.join(box.root, 'elsewhere')
  fs.mkdirSync(elsewhere)
  await screens.openSettings(page)
  await screens.answerOpenDialog(app, [elsewhere])
  await page.getByRole('button', { name: 'Change default location' }).click()
  await expect(page.getByText(elsewhere, { exact: true })).toBeVisible()

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
  await page.getByRole('tab', { name: 'Start' }).click()
  await screens.answerOpenDialog(app, [other])
  await page.getByRole('button', { name: 'Change location' }).click()
  await expect(page.getByText(other, { exact: true })).toBeVisible()
  await screens.createProject(page, 'Gamma')
  const file = path.join(other, 'Gamma.adman')
  expect(fs.existsSync(file)).toBe(true)

  const close = () => page.getByRole('button', { name: 'Close Gamma' }).click()
  await close()
  await expect(page.getByRole('tab', { name: 'Gamma' })).toHaveCount(0)
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
  // choice is between one: it is chosen at the start and stays chosen when clicked.
  const variants = page.getByRole('group', { name: 'Variants' }).getByRole('radio')
  await expect(variants).toHaveCount(1)
  await expect(variants.first()).toBeChecked()
  await variants.first().check()
  await expect(variants.first()).toBeChecked()
  await page.getByRole('button', { name: 'Back to project' }).click()
  await expect(page.getByRole('list', { name: 'Campaigns' })).toBeVisible()
}

// Settings · Agent runs (spec/agent-runs.md, "Settings block"): one tick per offered provider,
// and the limit, each saved to settings.json. Clicks only: no agent and no run.
export async function agentRunsTour(page: Page, box: Sandbox) {
  const saved = () => JSON.parse(fs.readFileSync(path.join(box.userData, 'settings.json'), 'utf8'))
  await screens.openSettings(page)
  const block = page.getByRole('region', { name: 'Agent runs' })
  const tick = (label: string) =>
    block.getByRole('checkbox', { name: `Let agents start runs with ${label}` })
  for (const label of ['ComfyUI', 'Fake provider']) await expect(tick(label)).toHaveCount(1)
  for (const label of ['Adobe Firefly', 'fal.ai Seedance']) await expect(tick(label)).toHaveCount(0)

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
