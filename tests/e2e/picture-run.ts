// Design wave CAMP-7 (C-12): a picture is made in the editor's Generate panel, as R2E-9 did for
// video, and runs are followed in the Activity panel. These steps drive the panel and the run
// dialog the way the campaign page's "Make pictures" panel was driven: the layer (the
// master's background), the prompt, the reference pictures, then the run dialog's

// provider, count and Generate. The provider and count are remembered per page until Generate
// opens the dialog, as the panel's select and count field were. Not a test file itself.
import { expect, type Locator, type Page } from '@playwright/test'
import { firstIds } from './held-run'
import { query } from './render-helpers'

type Choice = { provider?: string; count?: number }
const choices = new WeakMap<Page, Choice>()

function choiceOf(page: Page): Choice {
  const held = choices.get(page) ?? {}
  choices.set(page, held)
  return held
}

const canvas = (page: Page): Locator => page.getByRole('region', { name: /^Canvas, / })

// The selected layer's "Generate" Section (ED-4a: a region).
export const picturePanel = (page: Page): Locator =>
  page.getByRole('region', { name: 'Generate', exact: true })

// ED-4a: the chosen reference pictures are thumbnails in a strip, each with its ✕.
export const referenceThumbs = (panel: Locator): Locator =>
  panel.getByRole('list', { name: 'Reference pictures' }).getByRole('button', { name: /^Remove / })

// ED-4a: a start choice is a tile button with aria-pressed in the group "Start from".
export async function chooseStart(panel: Locator, name: string): Promise<void> {
  const tile = panel.getByRole('group', { name: 'Start from' }).getByRole('button', {
    name,
    exact: true,
  })
  await tile.click()
  await expect(tile).toHaveAttribute('aria-pressed', 'true')
}

// includeHidden: the licence, address and key dialogs hide the page behind them from roles.
export const runDialog = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Make pictures', includeHidden: true })

// The master's tab, opened from the overview unless an editor shows.
export async function openMaster(page: Page): Promise<void> {
  if (await canvas(page).isVisible()) return
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().dblclick()
  await expect(canvas(page)).toBeVisible()
}

// Selects the layer the pictures are made for and gives its name. The template's picture
// slots have no layer until one is filled, so it is the master's background, as in workflow
// 5.8; on a video post its "Make" switch is set to "Picture".
export async function chooseSlot(page: Page): Promise<string> {
  await openMaster(page)
  const { projectId, variantId } = await firstIds(page)
  const got = (await query(page, 'variant.get', { projectId, variantId })) as {
    layers: { type: string; name: string }[]
  }
  const layer = got.layers.find((l) => l.type === 'background')
  if (layer === undefined) throw new Error('the post has no background layer')
  await page
    .getByRole('list', { name: 'Layers' })
    .getByRole('button', { name: new RegExp(`^${layer.name}`) })
    .click()
  const make = picturePanel(page).getByRole('group', { name: 'Make' })
  if ((await make.count()) > 0) {
    const picture = make.getByRole('button', { name: 'Picture' })
    await picture.click()
    await expect(picture).toHaveAttribute('aria-pressed', 'true')
  }
  await expect(picturePanel(page).getByRole('textbox', { name: 'Prompt' })).toBeEnabled()
  return layer.name
}

async function panelShown(page: Page): Promise<Locator> {
  if (!(await picturePanel(page).isVisible())) await chooseSlot(page)
  return picturePanel(page)
}

export async function chooseProvider(page: Page, label: string): Promise<void> {
  choiceOf(page).provider = label
}

// How many pictures one Generate asks for; each is its own request to the provider.
export async function setCount(page: Page, count: number): Promise<void> {
  choiceOf(page).count = count
}

export async function setPrompt(page: Page, prompt: string): Promise<void> {
  await (await panelShown(page)).getByRole('textbox', { name: 'Prompt' }).fill(prompt)
}

// SP-7: the layer's first draft chooses the subject's photos. A run whose check is not about
// references lets them go in the reference dialog, so it sends what it sent before.
export async function untickReferences(page: Page): Promise<void> {
  const panel = await panelShown(page)
  await expect(panel.getByRole('list', { name: 'Reference pictures' })).toBeVisible()
  if ((await referenceThumbs(panel).count()) === 0) return
  await panel.getByRole('button', { name: 'Choose reference pictures…' }).click()
  const dialog = page.getByRole('dialog', { name: /^Reference pictures for / })
  const ticked = dialog.getByRole('checkbox', { checked: true })
  while ((await ticked.count()) > 0) await ticked.first().uncheck()
  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(referenceThumbs(panel)).toHaveCount(0)
}

// Generate… with the remembered provider and count; the caller reads, confirms or cancels.
// The Activity panel opens first, so the runs can be followed there.
export async function openRunDialog(page: Page): Promise<Locator> {
  const panel = await panelShown(page)
  await openActivity(page)
  await panel.getByRole('button', { name: 'Generate…' }).click()
  const dialog = runDialog(page)
  await expect(dialog).toBeVisible()
  const { provider, count } = choiceOf(page)
  if (provider) await dialog.getByRole('radio', { name: provider, exact: true }).check()
  if (count !== undefined) {
    await dialog.getByRole('spinbutton', { name: 'Pictures', exact: true }).fill(String(count))
  }
  return dialog
}

// The run dialog's own Generate: the one click that starts the run, its cost on screen.
export async function generate(page: Page): Promise<void> {
  const dialog = await openRunDialog(page)
  await dialog.getByRole('button', { name: 'Generate', exact: true }).click()
}

// The newest option of the newest run, under "New pictures" in Earlier options.
export const newPicture = (page: Page): Locator =>
  page
    .getByRole('region', { name: 'Earlier options' })
    .getByRole('button', { name: /^Use option 1 from / })
    .first()
    .locator('img')

// The line under Generate… once the first new picture is put on the empty layer.
export const ON_THE_LAYER = /^Done\. The first new picture is on the layer\./

// Runs are followed in the Activity panel (spec/screens-ai.md, "The activity panel").
export const activityPanel = (page: Page): Locator => page.getByRole('region', { name: 'Activity' })

export async function openActivity(page: Page): Promise<void> {
  if (await activityPanel(page).isVisible()) return
  await page.getByRole('button', { name: /^Activity/ }).click()
  await expect(activityPanel(page)).toBeVisible()
}

// A run row's stage while it works, as the adapter reports it (poll.ts).
export const WAITING_ON_SERVER = /Working.*waiting/
export const WORKING_ON_SERVER = /Working.*working/

export const runRows = (page: Page): Locator => activityPanel(page).getByRole('listitem')

// The newest run: the panel's first list is "Running" while one runs (one at a time here),
// else "Finished", newest first. `nth` counts down that list.
export const runRow = (page: Page, nth = 0): Locator =>
  activityPanel(page).getByRole('list').first().getByRole('listitem').nth(nth)
