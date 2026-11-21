// Steps through the built app's screens, shared by the offline spec and test:e2e:real
// (SPEC 14 1.56 E2E-R). Every step uses the screens as the user does, apart from the native
// file dialog, which cannot be clicked: answerOpenDialog replaces Electron's
// dialog.showOpenDialog in the main process (windows/dialogs.ts), so no app code changes.
// Not a test file itself. No helper here prints a value it is given.
import { expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import path from 'node:path'

export const E2E_BRIEF = path.resolve('tests/fixtures/briefs/e2e-brief.yaml')
export const E2E_CAMPAIGN = 'Harness Check'

// The next open dialogs answer with these paths, as if the user had picked them.
export async function answerOpenDialog(app: ElectronApplication, paths: string[]): Promise<void> {
  await app.evaluate(({ dialog }, given) => {
    dialog.showOpenDialog = (async () => ({
      canceled: given.length === 0,
      filePaths: given,
    })) as unknown as typeof dialog.showOpenDialog
  }, paths)
}

export async function createProject(page: Page, name: string): Promise<void> {
  await page.getByRole('tab', { name: 'Start' }).click()
  await page.getByLabel('Project name').fill(name)
  await page.getByRole('button', { name: 'Create project' }).click()
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
}

// Load a brief, see its summary, and create the campaign from it.
export async function loadBriefAndCreate(app: ElectronApplication, page: Page): Promise<void> {
  await answerOpenDialog(app, [E2E_BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  const brief = page.getByRole('region', { name: 'Brief' })
  await expect(brief.getByRole('list', { name: 'Subjects' })).toBeVisible()
  await brief.getByRole('button', { name: 'Create campaign' }).click()
  await page.getByRole('button', { name: 'Back to project' }).click()
  await expect(page.getByRole('button', { name: `Open ${E2E_CAMPAIGN}` })).toBeVisible()
}

export async function openCampaign(page: Page): Promise<void> {
  await page.getByRole('button', { name: `Open ${E2E_CAMPAIGN}` }).click()
  await expect(page.getByRole('heading', { name: E2E_CAMPAIGN, level: 2 })).toBeVisible()
}

export const picturePanel = (page: Page): Locator =>
  page.getByRole('region', { name: 'Make pictures' })

export async function chooseProvider(page: Page, label: string): Promise<void> {
  await picturePanel(page).getByLabel('Provider').selectOption({ label })
}

// A fixed made-up prompt, typed in place of the one the brief fills in.
export const E2E_PROMPT = 'A slim citrus can on a sunny picnic table, harness check'

export async function setPrompt(page: Page, prompt: string): Promise<void> {
  await picturePanel(page).getByLabel('Prompt').fill(prompt)
}

// Chooses the last picture slot the template offers and gives its ID.
export async function chooseSlot(page: Page): Promise<string> {
  const select = picturePanel(page).getByLabel('Slot')
  const last = await select.locator('option').last().getAttribute('value')
  if (last === null) throw new Error('the template offers no picture slot')
  await select.selectOption(last)
  await expect(select).toHaveValue(last)
  return last
}

// How many pictures one Generate asks for; each is its own request to the provider.
export async function setCount(page: Page, count: number): Promise<void> {
  await picturePanel(page)
    .getByRole('spinbutton', { name: 'Pictures', exact: true })
    .fill(String(count))
}

export async function generate(page: Page): Promise<void> {
  await picturePanel(page).getByRole('button', { name: 'Generate' }).click()
}

// SPEC 14 1.57 TP-6: the "Make a video" card, prompt only.
export const E2E_VIDEO_PROMPT = 'A slim citrus can turning slowly on a table, harness check'

export const videoPanel = (page: Page): Locator =>
  page.getByRole('region', { name: 'Make a video' })

export async function startVideo(page: Page, seconds: number): Promise<void> {
  const panel = videoPanel(page)
  await panel.getByLabel('Provider').selectOption({ label: 'ComfyUI' })
  await panel.getByLabel('Prompt').fill(E2E_VIDEO_PROMPT)
  await panel.getByLabel('Length (seconds)').fill(String(seconds))
  await panel.getByRole('button', { name: 'Start' }).click()
}

// The newest row's clip has its metadata (HAVE_METADATA or more): the built app's CSP and
// adman-asset:// protocol let the clip through.
export async function clipHasMetadata(page: Page, timeout: number): Promise<void> {
  const clip = runRow(page).getByLabel('Video result')
  await expect(clip).toBeVisible({ timeout })
  await expect
    .poll(() => clip.evaluate((v: HTMLVideoElement) => v.readyState), { timeout })
    .toBeGreaterThanOrEqual(1)
}

// A run row's stage while it works, as the adapter reports it (poll.ts).
export const WAITING_ON_SERVER = /Working.*waiting/
export const WORKING_ON_SERVER = /Working.*working/

export const runRows = (page: Page): Locator =>
  page.getByRole('list', { name: 'Runs' }).getByRole('listitem')

// The run rows are newest first; `nth` counts from the newest.
export const runRow = (page: Page, nth = 0): Locator => runRows(page).nth(nth)

export async function openSettings(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  return page.getByRole('region', { name: 'ComfyUI server' })
}

// Types the address and saves it. The caller keeps the address out of every name and check.
export async function saveAddress(comfy: Locator, address: string): Promise<void> {
  await comfy.getByLabel('Server address').fill(address)
  await comfy.getByRole('button', { name: 'Save' }).click()
  await expect(comfy.getByText('No address saved.')).toBeHidden()
  await expect(comfy.getByRole('button', { name: 'Remove' })).toBeVisible()
}

// Check, and wait for the server's version line.
export async function checkServer(comfy: Locator, timeout = 60_000): Promise<void> {
  await comfy.getByRole('button', { name: 'Check' }).click()
  await expect(comfy.getByText(/^The server answered: ComfyUI /)).toBeVisible({ timeout })
}

// Exact, because one workflow's label can begin another's (the two MOSS labels).
export const workflowRow = (comfy: Locator, label: string): Locator =>
  comfy.getByRole('list', { name: 'Workflows' }).getByRole('listitem', { name: label, exact: true })

// Every top-level workflow row; a row's missing items are its own nested list.
export const workflowRows = (comfy: Locator): Locator =>
  comfy.getByRole('list', { name: 'Workflows' }).locator(':scope > li')

// What a checked workflow row shows (comfy-check-result.tsx).
export const CHECK_RESULT = /Complete|Missing \d+ items?/

export const MOSS_LABEL = 'MOSS-Image: picture from a prompt'
export const H3_TEXT_LABEL = 'MiniMax H3: video from a prompt'
export const FLUX_LABEL = 'FLUX 3 klein: picture from a prompt and one reference picture'

// S2-6 (D-088): a run of a model that needs a commercial licence first shows the licence
// dialog; Confirm, with the box left as it is, sends the run.
export const licenceDialog = (page: Page): Locator =>
  page.getByRole('dialog', { name: /requires a commercial license/ })

export async function confirmLicence(page: Page): Promise<void> {
  const dialog = licenceDialog(page)
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  await expect(dialog).toBeHidden()
}
