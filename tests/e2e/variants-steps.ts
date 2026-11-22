// P5-19: the steps workflows 5.3 and 5.4 share (spec/screens-variants.md): a campaign from the
// brief form with more languages or sizes, a direction's section and tiles, fan-out, the sync
// review and "Accept selected", and the editor edits the workflows make. Every step uses the
// screens as the user does; the reads at the end are queries the window itself sends.
// Not a test file itself. Made-up names only.
import { expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import * as screens from './screens'
import { query } from './render-helpers'

// The SP-5 brief through its form, with the Languages field typed over and more ready-made sizes
// turned on (HOME-3a: the size chip "16x9 (1920×1080)"), then "Create campaign": the campaign
// page opens.
export async function createFromForm(
  app: ElectronApplication,
  page: Page,
  change: { languages?: string; sizes?: string[] },
): Promise<void> {
  await screens.answerOpenDialog(app, [screens.E2E_BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  const form = page.getByRole('region', { name: 'New campaign' })
  await screens.expectPhoto(form, 1, screens.E2E_PHOTO)
  if (change.languages) await form.getByLabel('Languages', { exact: true }).fill(change.languages)
  for (const size of change.sizes ?? []) {
    const chip = form.getByRole('button', { name: size, exact: true })
    if ((await chip.getAttribute('aria-pressed')) !== 'true') await chip.click()
    await expect(chip).toHaveAttribute('aria-pressed', 'true')
  }
  await form.getByRole('button', { name: 'Create campaign' }).click()
  await expect(page.getByRole('heading', { name: screens.E2E_CAMPAIGN, level: 2 })).toBeVisible()
}

export const section = (page: Page, direction: string): Locator =>
  page.getByRole('region', { name: direction, exact: true })

export const grid = (page: Page, direction: string): Locator =>
  section(page, direction).getByRole('list', { name: `Variants in ${direction}`, exact: true })

// The tile whose size line holds `line`, such as "1080×1920 · en". CAMP-1: the size line is in
// the tile button's name, "{title} · {sizeLine}".
export const tile = (page: Page, direction: string, line: string): Locator =>
  grid(page, direction)
    .getByRole('listitem')
    .filter({ has: page.getByRole('button', { name: line }) })

// The tile's own button (a double-click opens it in the editor), named "{title} · {sizeLine}";
// CAMP-1's marks are buttons too, named by their words.
export const tileButton = (t: Locator): Locator => t.getByRole('button', { name: / · \d+×\d+ · / })

// CAMP-1: the mark is an icon whose word is its tooltip.
export const outOfDate = (page: Page, direction: string): Locator =>
  section(page, direction).getByTitle('Out of date', { exact: true })

// CAMP-2: a tile's other actions ("Open", "Open in a tab", "Quick look", "Delete…") are items
// of its More menu "More actions for {title}". Chooses one and gives back the tile's title.
export async function tileMore(page: Page, t: Locator, item: string): Promise<string> {
  const more = t.getByRole('button', { name: /^More actions for / })
  const title = ((await more.getAttribute('aria-label')) ?? '').replace(/^More actions for /, '')
  await more.click()
  await page.getByRole('menuitem', { name: item, exact: true }).click()
  return title
}

// CAMP-2: a direction's "New direction…", "Rename…" and "Delete direction…" are items of its
// More menu "More actions for {name}".
export async function directionMore(page: Page, direction: string, item: string): Promise<void> {
  await section(page, direction)
    .getByRole('button', { name: `More actions for ${direction}`, exact: true })
    .click()
  await page.getByRole('menuitem', { name: item, exact: true }).click()
}

export type FanOut = { sizes?: string[]; languages?: string[]; fill?: string }

// "Fan out…", the chips pressed, a "Generate fill" size with the fake provider, "Make {n}
// variants". The fill's cost line is read before the click that sends.
export async function fanOut(page: Page, direction: string, ask: FanOut): Promise<void> {
  await section(page, direction).getByRole('button', { name: 'Fan out…' }).click()
  const dialog = page.getByRole('dialog', { name: `Fan out ${direction}` })
  const press = async (name: string) => {
    const chip = dialog.getByRole('button', { name, exact: true })
    if ((await chip.getAttribute('aria-pressed')) !== 'true') await chip.click()
    await expect(chip).toHaveAttribute('aria-pressed', 'true')
  }
  for (const size of ask.sizes ?? []) await press(size)
  for (const tag of ask.languages ?? []) await press(tag)
  if (ask.fill) {
    await dialog
      .getByRole('group', { name: `Background for ${ask.fill}` })
      .getByRole('radio', { name: 'Generate fill: extend the picture with AI' })
      .check()
    await dialog.getByLabel('Provider').selectOption({ label: 'Fake provider' })
    await expect(dialog.getByText('1 fill on Fake provider. Nothing is charged.')).toBeVisible()
  }
  await dialog.getByRole('button', { name: /^Make (\d+ )?variants?$/ }).click()
  await expect(dialog).toHaveCount(0)
}

// "Sync {n} out of date…" and the review, once it has read the changes.
export async function openSyncReview(page: Page, direction: string, count: number) {
  await section(page, direction)
    .getByRole('button', { name: `Sync ${count} out of date…` })
    .click()
  const dialog = page.getByRole('dialog', { name: `Sync ${direction}` })
  await expect(dialog.getByRole('button', { name: 'Accept all' })).toBeEnabled()
  return dialog
}

// The review's group for one variant, headed "{title} · {sizeLabel} · {language}".
export const changesOf = (review: Locator, heading: RegExp): Locator =>
  review.getByRole('group', { name: heading })

// Ticks every change of the named variant's group and sends "Accept selected".
export async function acceptSelected(review: Locator, heading: RegExp): Promise<void> {
  const boxes = changesOf(review, heading).getByRole('checkbox')
  await expect(boxes.first()).toBeVisible()
  for (const box of await boxes.all()) await box.check()
  await review.getByRole('button', { name: 'Accept selected' }).click()
  await expect(review).toBeHidden()
}

const properties = (page: Page): Locator => page.getByRole('region', { name: 'Properties' })

// Opens the tile in the editor and selects the named layer.
export async function editLayer(page: Page, t: Locator, layer: string): Promise<void> {
  await tileButton(t).dblclick()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
  await page
    .getByRole('list', { name: 'Layers' })
    .getByRole('button', { name: new RegExp(`^${layer}`) })
    .first()
    .click()
  await expect(properties(page).getByRole('heading', { name: layer })).toBeVisible()
}

// The text's Colour (ED-2: a swatch field): typed in its "+" popover and saved with Enter. The
// popover is opened again until it shows the saved colour, then closed.
export async function setColour(page: Page, hex: string): Promise<void> {
  const colour = properties(page).getByRole('group', { name: 'Colour', exact: true })
  const plus = colour.getByRole('button', { name: 'Other colour' })
  const field = properties(page).getByRole('textbox', { name: 'Hex colour' })
  await plus.click()
  await field.fill(hex)
  await field.press('Enter')
  await expect(field).toBeHidden()
  await expect(async () => {
    if ((await plus.getAttribute('aria-expanded')) === 'true') await plus.click()
    await plus.click()
    await expect(field).toHaveValue(hex.toLowerCase(), { timeout: 1000 })
  }).toPass()
  await field.press('Escape')
}

// The text's Copy field, saved on leaving it.
export async function setCopy(page: Page, copy: string): Promise<void> {
  const field = properties(page).getByLabel('Copy', { exact: true })
  await field.fill(copy)
  await field.blur()
}

export async function showOverview(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Variants', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Fan out…' }).first()).toBeVisible()
}

type Row = { id: string; sizeLabel: string; language: string; directionId: string }
type Read = { directions: { id: string; name: string }[]; variants: Row[] }
type Layer = {
  type: string
  slot: string | null
  copy: string | null
  style: { color?: string }
  source: { assetId: string } | null
}

export async function campaignRead(page: Page, place: { projectId: string; campaignId: string }) {
  return (await query(page, 'campaign.get', place)) as unknown as Read
}

export async function layerOf(page: Page, projectId: string, variantId: string, slot: string) {
  const read = (await query(page, 'variant.get', { projectId, variantId })) as unknown as {
    layers: Layer[]
  }
  return read.layers.find((l) => l.slot === slot || l.type === slot)
}
