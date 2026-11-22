// P7-24: the steps of workflow 5.5 (a video variant) through the built app's screens, for
// video-variant.spec.ts, video-resume.spec.ts and the P7-24 shots. Every provider is the fake
// one; the only main-process step is the native file dialog's answer (screens.ts). Not a test
// file itself. Made-up names and a drawn picture only.
import { expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from './screens'
import { firstIds } from './held-run'
import { makePng, query } from './render-helpers'
import { timeline } from './timeline-seed'

export const TINY = path.resolve('tests/fixtures/video/tiny.mp4')
export const BACKDROP = 'dune-backdrop.png'
export const VIDEO_PROMPT = 'Warm light drifts slowly across the sand dunes at dusk'

export const format = (page: Page) => page.getByRole('radiogroup', { name: 'Format' })
export const length = (page: Page) => page.getByRole('textbox', { name: 'Length (seconds)' })
export const clips = (page: Page) => timeline(page).getByRole('list', { name: 'Clips' })
export const clipBlocks = (page: Page) => clips(page).getByRole('button', { name: /^Clip \d+: / })
export const clipStart = (page: Page, n: number) =>
  clips(page).getByRole('slider', { name: new RegExp(`^Start of Clip ${n}: `) })
export const clipEnd = (page: Page, n: number) =>
  clips(page).getByRole('slider', { name: new RegExp(`^End of Clip ${n}: `) })
export const clipBlock = (page: Page, n: number) =>
  clips(page).getByRole('button', { name: new RegExp(`^Clip ${n}: `) })
export const valueOf = async (slider: Locator) => Number(await slider.getAttribute('aria-valuenow'))

// 180 by 320: a deep orange sky at the top fading to a pale sand at the foot.
export async function drawnBackdrop(app: ElectronApplication, folder: string): Promise<string> {
  const bgra: number[] = []
  for (let y = 0; y < 320; y += 1) {
    const t = y / 320
    for (let x = 0; x < 180; x += 1) bgra.push(40 + 150 * t, 90 + 120 * t, 220 + 20 * t, 255)
  }
  const file = path.join(folder, BACKDROP)
  fs.writeFileSync(file, await makePng(app, { width: 180, height: 320, bgra }))
  return file
}

export async function selectLayer(page: Page, name: string): Promise<void> {
  await page
    .getByRole('list', { name: 'Layers' })
    .getByRole('button', { name: new RegExp(`^${name}`) })
    .click()
}

async function layerNames(page: Page): Promise<{ type: string; name: string }[]> {
  const { projectId, variantId } = await firstIds(page)
  const got = (await query(page, 'variant.get', { projectId, variantId })) as {
    layers: { type: string; name: string }[]
  }
  return got.layers
}

export async function backgroundName(page: Page): Promise<string> {
  return (await layerNames(page)).find((l) => l.type === 'background')!.name
}

// The background layer is given the drawn picture through "Choose picture…".
async function choosePicture(app: ElectronApplication, page: Page, file: string): Promise<void> {
  await selectLayer(page, await backgroundName(page))
  const panel = page.getByRole('region', { name: 'Properties' })
  await panel.getByRole('button', { name: 'Choose picture…' }).click()
  const chooser = page.getByRole('dialog', { name: /^Choose a picture for / })
  await screens.answerOpenDialog(app, [file])
  await chooser.getByRole('button', { name: 'Import pictures…' }).click()
  await chooser.getByRole('button', { name: new RegExp(BACKDROP.replace('.png', '')) }).click()
  await expect(chooser).toHaveCount(0)
}

// Step 1: a project from the test brief, its master in the editor with a background picture,
// changed to video and set to 8 s. It ends in the editor with the timeline shown.
export async function videoWithBackdrop(
  app: ElectronApplication,
  page: Page,
  name: string,
  folder: string,
) {
  await screens.createProject(page, name)
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().dblclick()
  await expect(format(page)).toBeVisible()
  await choosePicture(app, page, await drawnBackdrop(app, folder))
  await format(page).getByRole('radio', { name: 'Video' }).click()
  await expect(format(page).getByRole('radio', { name: 'Video' })).toBeChecked()
  await expect(timeline(page)).toBeVisible()
  await length(page).fill('8')
  await length(page).press('Enter')
  await expect(length(page)).toHaveValue('8.0')
}

// A file through "Add clip…" and "Import…", placed at the first free position.
export async function importAndAdd(app: ElectronApplication, page: Page, file: string) {
  await screens.answerOpenDialog(app, [file])
  await timeline(page).getByRole('button', { name: 'Add clip…' }).click()
  await timeline(page).getByRole('button', { name: 'Import…' }).click()
  const list = timeline(page).getByRole('list', { name: 'Pictures and videos' })
  await list.getByRole('button', { name: path.basename(file) }).click()
}

// A fake run from the post's background, started on the "Make a video" card in the overview.
export async function startFromBackground(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Overview' }).click()
  const card = screens.videoPanel(page)
  await card.getByLabel('Provider').selectOption({ label: 'Fake provider' })
  await card.getByLabel('Prompt').fill(VIDEO_PROMPT)
  await card.getByLabel('Start from').selectOption({ label: "The post's background" })
  await card.getByRole('button', { name: 'Start' }).click()
}

// Back to the master's editor from the overview.
export async function backToEditor(page: Page): Promise<void> {
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().dblclick()
  await expect(timeline(page)).toBeVisible()
}

// The first layer whose panel has the Animation fields: a text layer. Gives its name.
export async function selectTextLayer(page: Page): Promise<string> {
  const tracks = timeline(page).getByRole('list', { name: 'Layer tracks' })
  const bars = tracks.getByRole('button', { name: /^Timing of / })
  await expect(bars.first()).toBeVisible()
  for (const label of await bars.evaluateAll((els) => els.map((e) => e.ariaLabel ?? ''))) {
    const name = label.replace(/^Timing of /, '')
    await selectLayer(page, name)
    if ((await page.getByRole('combobox', { name: 'Entrance' }).count()) > 0) return name
  }
  throw new Error('The ad has no text layer.')
}
