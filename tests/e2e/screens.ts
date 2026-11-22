// Steps through the built app's screens, shared by the offline spec and test:e2e:real
// (SPEC 14 1.56 E2E-R). Every step uses the screens as the user does, apart from the native
// file dialog, which cannot be clicked: answerOpenDialog replaces Electron's
// dialog.showOpenDialog in the main process (windows/dialogs.ts), so no app code changes.
// Not a test file itself. No helper here prints a value it is given.
import { expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import path from 'node:path'
import { firstIds } from './held-run'
import { query } from './render-helpers'
import { openSettingsPage } from './settings-pages'

export { chooseSettingsPage, openSettingsPage } from './settings-pages'

export const E2E_BRIEF = path.resolve('tests/fixtures/briefs/e2e-brief.yaml')
export const E2E_CAMPAIGN = 'Harness Check'
// The made-up photo the brief names for its one subject (SP-5).
export const E2E_PHOTO = path.resolve('tests/fixtures/briefs/photos/citrus-can.png')

// The next open dialogs answer with these paths, as if the user had picked them.
export async function answerOpenDialog(app: ElectronApplication, paths: string[]): Promise<void> {
  await app.evaluate(({ dialog }, given) => {
    dialog.showOpenDialog = (async () => ({
      canceled: given.length === 0,
      filePaths: given,
    })) as unknown as typeof dialog.showOpenDialog
  }, paths)
}

// The start screen, through the project switcher (spec/editor.md, "The shell").
export async function showStart(page: Page): Promise<void> {
  await page.locator('header button[aria-haspopup="menu"]').click()
  await page.getByRole('menuitem', { name: 'Start' }).click()
}

export async function createProject(page: Page, name: string): Promise<void> {
  await showStart(page)
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
  // SP-5: the brief names its photo; Create waits until it is in the row.
  await expectPhoto(brief, 1, E2E_PHOTO)
  await brief.getByRole('button', { name: 'Create campaign' }).click()
  await page.getByRole('button', { name: 'Back to project' }).click()
  await expect(page.getByRole('button', { name: `Open ${E2E_CAMPAIGN}` })).toBeVisible()
}

// The picture of `file` in the photo list of subject `row` (counted from 1) on the brief form.
export const photoIn = (form: Locator, row: number, file: string): Locator =>
  form
    .getByRole('list', { name: `Photos of subject ${row}` })
    .getByRole('img', { name: path.basename(file), exact: true })

// Waits until that picture is drawn (its file loaded), so a screenshot shows it.
export async function expectPhoto(form: Locator, row: number, file: string): Promise<void> {
  const img = photoIn(form, row, file)
  await expect(img).toBeVisible()
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0)
}

// SP-5: "Add photos" of subject `row` on the brief form, answered with `file`.
export async function addPhoto(
  app: ElectronApplication,
  form: Locator,
  row: number,
  file: string,
): Promise<void> {
  await answerOpenDialog(app, [file])
  await form.getByRole('button', { name: `Add photos to subject ${row}` }).click()
  await expectPhoto(form, row, file)
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

// SP-5: the subject's photos are pre-ticked as references when the campaign page opens. A run
// whose check is not about references unticks them first, so it sends what it sent before.
export async function untickReferences(page: Page): Promise<void> {
  const ticked = picturePanel(page)
    .getByRole('region', { name: 'Reference pictures' })
    .getByRole('checkbox', { checked: true })
  await expect(ticked.first()).toBeVisible()
  while ((await ticked.count()) > 0) await ticked.first().uncheck()
  await expect(ticked).toHaveCount(0)
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

// R2E-9 (spec/phases/round-2-editor.md D4): a video is made in the editor's Generate panel, on
// the background layer of a video post with "Video" chosen; the run dialog's Generate sends.
export const E2E_VIDEO_PROMPT = 'A slim citrus can turning slowly on a table, harness check'
export const VIDEO_SHAPE_START = 'Another picture of the same shape…'
export const VIDEO_REFERENCE_START = 'Reference pictures'

const canvas = (page: Page): Locator => page.getByRole('region', { name: /^Canvas, / })
// includeHidden: the licence dialog hides the page behind it, the run dialog too, from roles.
export const videoDialog = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Make a video', includeHidden: true })

// The master's tab (opened from the overview unless an editor shows), its background layer
// selected, and its "Generate" group with "Video" chosen.
export async function videoPanel(page: Page): Promise<Locator> {
  if (!(await canvas(page).isVisible())) {
    await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().dblclick()
    await expect(canvas(page)).toBeVisible()
  }
  const { projectId, variantId } = await firstIds(page)
  const got = (await query(page, 'variant.get', { projectId, variantId })) as {
    layers: { type: string; name: string }[]
  }
  const background = got.layers.find((l) => l.type === 'background')!.name
  await page
    .getByRole('list', { name: 'Layers' })
    .getByRole('button', { name: new RegExp(`^${background}`) })
    .click()
  const panel = page.getByRole('group', { name: 'Generate' })
  const video = panel.getByRole('group', { name: 'Make' }).getByRole('button', { name: 'Video' })
  await video.click()
  await expect(video).toHaveAttribute('aria-pressed', 'true')
  return panel
}

// SP-5: "Start from" `start`, then `files` added through the picture list's own button; the
// first added is the one picture chosen. The reference list chooses the subject's photo first
// (SP-7, checked when `photoFirst`); it is let go, so only the added picture is sent.
export async function chooseAddedPicture(
  app: ElectronApplication,
  page: Page,
  start: string,
  files: string[],
  photoFirst = false,
): Promise<void> {
  const panel = await videoPanel(page)
  await panel.getByRole('radio', { name: start, exact: true }).check()
  const shape = start === VIDEO_SHAPE_START
  const list = panel.getByRole('region', {
    name: shape ? 'Pictures of the same shape' : 'Picture to start from',
  })
  const photo = list.getByLabel(path.basename(E2E_PHOTO), { exact: true })
  if (photoFirst) await expect(photo).toBeChecked()
  await answerOpenDialog(app, files)
  await list.getByRole('button', { name: shape ? 'Add pictures…' : 'Add pictures' }).click()
  const added = list.getByLabel(path.basename(files[0]!), { exact: true })
  await expect(added).toBeChecked()
  if ((await photo.count()) > 0 && (await photo.isChecked())) await photo.uncheck()
  await expect(list.locator('input:checked')).toHaveCount(1)
}

export async function startFromAddedPicture(
  app: ElectronApplication,
  page: Page,
  start: string,
  file: string,
): Promise<void> {
  await chooseAddedPicture(app, page, start, [file], start === VIDEO_REFERENCE_START)
}

// The run dialog's `provider` and its Generate. Once the dialog closes (the run started) the
// overview shows, with the runs; while the licence dialog asks, the caller answers it.
export async function generateVideo(page: Page, provider: string): Promise<void> {
  const dialog = videoDialog(page)
  await dialog.getByRole('radio', { name: provider, exact: true }).check()
  await dialog.getByRole('button', { name: 'Generate', exact: true }).click()
  const asked = licenceDialog(page)
  await expect.poll(async () => (await asked.isVisible()) || !(await dialog.isVisible())).toBe(true)
  if (!(await dialog.isVisible())) await showOverview(page)
}

export async function showOverview(page: Page): Promise<void> {
  const tab = page.getByRole('tab', { name: 'Overview' })
  await tab.click()
  await expect(tab).toHaveAttribute('aria-selected', 'true')
}

// A run dialog left open (its licence question cancelled) is cancelled first.
export async function startVideo(page: Page, seconds: number): Promise<void> {
  const left = videoDialog(page)
  if (await left.isVisible()) await left.getByRole('button', { name: 'Cancel' }).click()
  const panel = await videoPanel(page)
  await panel.getByRole('textbox', { name: 'Prompt' }).fill(E2E_VIDEO_PROMPT)
  await panel.getByLabel('Clip length (seconds)').fill(String(seconds))
  await panel.getByRole('button', { name: 'Generate…' }).click()
  await generateVideo(page, 'ComfyUI')
}

// The panel's clip has its metadata (HAVE_METADATA or more): the built app's CSP and
// adman-asset:// protocol let the clip through.
export async function clipHasMetadata(page: Page, timeout: number): Promise<void> {
  const clip = (await videoPanel(page)).getByLabel('Video result')
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
  await openSettingsPage(page, 'AI services')
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

// A video's run dialog then closes and the overview shows, as after generateVideo.
export async function confirmLicence(page: Page): Promise<void> {
  const dialog = licenceDialog(page)
  const video = await videoDialog(page).isVisible()
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  await expect(dialog).toBeHidden()
  if (!video) return
  await expect(videoDialog(page)).toBeHidden()
  await showOverview(page)
}
