// LK-7: the steps the three looks share. Set-up (a project and a 1080 × 1920 campaign) uses
// commands, as other shots files do; every other helper here works the screens the way a user
// does: layer rows, the picture chooser, panel fields, canvas drags and the Layout dialog.
import { expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { command, query } from '../e2e/render-helpers'

export type Brief = { name: string; message: string; callToAction: string }

// One project with one campaign at 1080 × 1920, its text taken from the brief; then open it.
export async function campaignAndOpen(page: Page, brief: Brief): Promise<void> {
  await screens.createProject(page, 'Look pack')
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  const projectId = state.openProjects[0]!.projectId
  await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: brief.name,
      region: 'US',
      audience: 'Neighbours',
      message: brief.message,
      callToAction: brief.callToAction,
      subjects: [{ name: 'Product' }],
    },
    subjectMap: [{ subjectId: 'product', create: true }],
    languages: ['en'],
    sizes: [{ label: '1080x1920', width: 1080, height: 1920 }],
    templateId: 'starter',
  })
  await page.getByRole('button', { name: `Open ${brief.name}` }).click()
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().dblclick()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
}

export const panel = (page: Page) => page.getByRole('region', { name: 'Properties' })

// Click the layer's row in the Layers list.
export async function select(page: Page, name: string): Promise<void> {
  await page
    .getByRole('list', { name: 'Layers' })
    .getByRole('button', { name: new RegExp(`^${name}`) })
    .first()
    .click()
  await expect(panel(page).getByRole('heading', { name })).toBeVisible()
}

// "Choose picture…", "Import pictures…" with the file picked, then the picture's tile.
export async function choosePicture(
  app: ElectronApplication,
  page: Page,
  file: string,
): Promise<void> {
  await panel(page).getByRole('button', { name: 'Choose picture…' }).click()
  const chooser = page.getByRole('dialog', { name: /^Choose a picture for / })
  await screens.answerOpenDialog(app, [file])
  await chooser.getByRole('button', { name: 'Import pictures…' }).click()
  const stem = path.basename(file, '.png')
  await chooser.getByRole('button', { name: new RegExp(stem) }).click()
  await expect(chooser).toHaveCount(0)
}

// A number field in a group: type the value and press Enter, as the panel saves.
export async function setNumber(group: Locator, label: string, value: number): Promise<void> {
  const field = group.getByRole('spinbutton', { name: label, exact: true })
  await field.fill(String(value))
  await field.press('Enter')
  await expect(field).toHaveValue(String(value))
}

type Box = { x: number; y: number; width: number; height: number }

// Type a box into the Position and size fields (size first, so the place is not moved after).
export async function setBox(page: Page, box: Box): Promise<void> {
  const fields = panel(page).getByRole('group', { name: 'Position and size' })
  await setNumber(fields, 'Width', box.width)
  await setNumber(fields, 'Height', box.height)
  await setNumber(fields, 'X', box.x)
  await setNumber(fields, 'Y', box.y)
}

// "Add picture layer" (it is selected), its picture from the chooser, and a box if given.
export async function addPicture(
  app: ElectronApplication,
  page: Page,
  file: string,
  box?: Box,
): Promise<void> {
  const before = await page.getByRole('list', { name: 'Layers' }).getByRole('listitem').count()
  await page.getByRole('button', { name: 'Add picture layer' }).click()
  await expect(page.getByRole('list', { name: 'Layers' }).getByRole('listitem')).toHaveCount(
    before + 1,
  )
  await expect(panel(page).getByText('Empty picture')).toBeVisible()
  await choosePicture(app, page, file)
  if (box) await setBox(page, box)
}

export async function applyLayout(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Layout…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Choose a layout' })
  await dialog.getByRole('radio', { name }).check()
  await dialog.getByRole('button', { name: 'Apply' }).click()
  await expect(dialog).toHaveCount(0)
}

// The ad's place on screen and its scale (screen pixels per variant pixel), from the box that
// holds the scaled stage.
async function stage(page: Page) {
  const rect = (await page.locator('[data-stage]').locator('..').boundingBox())!
  return { ...rect, scale: rect.width / 1080 }
}

// Press at a screen point and drag by a distance in variant pixels, in small steps with a
// frame's pause between them, as a hand moves (the editor draws the drag once a frame).
async function dragFrom(page: Page, x: number, y: number, dx: number, dy: number, scale: number) {
  const steps = 20
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(x + (dx * scale * i) / steps, y + (dy * scale * i) / steps)
    await page.waitForTimeout(20)
  }
  await page.waitForTimeout(100)
  await page.mouse.up()
}

// Drag the selected layer's bottom-right handle by a distance in variant pixels.
export async function resizeCorner(page: Page, dx: number, dy: number): Promise<void> {
  const { scale } = await stage(page)
  const handle = (await page.locator('[data-selection] [data-handle="se"]').boundingBox())!
  await dragFrom(page, handle.x + handle.width / 2, handle.y + handle.height / 2, dx, dy, scale)
}

// Press inside the selected layer, a quarter of the way in, and drag it.
export async function moveSelected(page: Page, dx: number, dy: number): Promise<void> {
  const { scale } = await stage(page)
  const box = (await page.locator('[data-selection]').boundingBox())!
  await dragFrom(page, box.x + box.width / 4, box.y + box.height / 4, dx, dy, scale)
}

// The selected layer's box, read from the Position and size fields.
export async function selectedBox(page: Page) {
  const read = async (label: string) =>
    Number(await panel(page).getByRole('spinbutton', { name: label, exact: true }).inputValue())
  return {
    x: await read('X'),
    y: await read('Y'),
    width: await read('Width'),
    height: await read('Height'),
  }
}

// Every text layer fits its box: no "does not fit" line in the banner (spec/editor.md, "Banner").
export async function expectTextFits(page: Page): Promise<void> {
  await page.waitForTimeout(500)
  await expect(page.getByText(/do(es)? not fit their box|does not fit its box/)).toHaveCount(0)
}

// Clear the selection by clicking the backdrop beside the ad, so no handles are drawn.
export async function clearSelection(page: Page): Promise<void> {
  await page.locator('[data-backdrop]').click({ position: { x: 4, y: 4 } })
  await expect(panel(page).getByText('Select a layer to change it.')).toBeVisible()
}

const FOLDER = path.resolve('shots')
const LARGE = { width: 2200, height: 2500 }

// The ad alone, or a part of it given in variant pixels, at 100 % zoom (one screen pixel per
// variant pixel) in a large window; then the zoom goes back to Fit and the window to its size.
export async function adPicture(
  page: Page,
  name: string,
  part = { x: 0, y: 0, width: 1080, height: 1920 },
): Promise<void> {
  const before = page.viewportSize()!
  await page.setViewportSize(LARGE)
  await page.getByRole('button', { name: 'Zoom out' }).click()
  await expect(page.getByRole('button', { name: '100%' })).toBeVisible()
  await page.waitForTimeout(500)
  const s = await stage(page)
  fs.mkdirSync(FOLDER, { recursive: true })
  await page.screenshot({
    path: path.join(FOLDER, `${name}.png`),
    clip: { x: s.x + part.x, y: s.y + part.y, width: part.width, height: part.height },
  })
  await page.getByRole('button', { name: '100%' }).click()
  await page.setViewportSize(before)
  await page.waitForTimeout(300)
}
