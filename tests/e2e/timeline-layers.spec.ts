// P7-19 (spec/phases/phase-07-slices-2.md): the layer tracks in the built app. An ad is
// switched to video through the top bar; a text layer gets an entrance preset; a drag on a
// timing bar's end and on the entrance block's end each make one undo step; the canvas at a
// time inside the entrance draws the text part-faded, and after it in full.
import { test, expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import fs from 'node:fs'
import { makeSandbox, launch, type Sandbox } from './launch'
import * as screens from './screens'
import { ruler, timeline } from './timeline-seed'

let box: Sandbox
let app: ElectronApplication | undefined
test.beforeEach(() => {
  box = makeSandbox()
})
test.afterEach(async () => {
  await app?.close()
  app = undefined
  fs.rmSync(box.root, { recursive: true, force: true })
})

const tracks = (page: Page) => timeline(page).getByRole('list', { name: 'Layer tracks' })
const slider = (page: Page, name: string) => tracks(page).getByRole('slider', { name })
const valueOf = async (s: Locator) => Number(await s.getAttribute('aria-valuenow'))
const undo = (page: Page) => page.getByRole('button', { name: 'Undo' }).click()

async function openAsVideo(page: Page): Promise<void> {
  await screens.createProject(page, 'Layer Track Check')
  await screens.loadBriefAndCreate(app!, page)
  await screens.openCampaign(page)
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().dblclick()
  await page
    .getByRole('radiogroup', { name: 'Format' })
    .getByRole('radio', { name: 'Video' })
    .click()
  await expect(timeline(page)).toBeVisible()
}

// The first layer whose panel has the Animation fields: a text layer.
async function selectTextLayer(page: Page): Promise<string> {
  const bars = tracks(page).getByRole('button', { name: /^Timing of / })
  await expect(bars.first()).toBeVisible()
  for (const label of await bars.evaluateAll((els) => els.map((e) => e.ariaLabel ?? ''))) {
    const name = label.replace(/^Timing of /, '')
    const rows = page.getByRole('list', { name: 'Layers' })
    await rows.getByRole('button', { name: new RegExp(`^${name}`) }).click()
    if ((await page.getByRole('combobox', { name: 'Entrance' }).count()) > 0) return name
  }
  throw new Error('The ad has no text layer.')
}

// Drags `handle` by `share` of its lane's width.
async function dragBy(page: Page, handle: Locator, share: number): Promise<void> {
  const lane = (await handle.locator('xpath=../..').boundingBox())!
  const at = (await handle.boundingBox())!
  const x = at.x + at.width / 2
  const y = at.y + at.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + lane.width * share, y, { steps: 6 })
  await page.mouse.up()
}

async function scrubTo(page: Page, share: number): Promise<void> {
  const r = (await ruler(page).boundingBox())!
  await page.mouse.click(r.x + r.width * share, r.y + r.height / 2)
}

// The opacity the canvas draws each layer box at.
const opacities = (page: Page) =>
  page
    .getByRole('region', { name: /^Canvas, / })
    .locator('[data-layer-id]')
    .evaluateAll((els) => els.map((e) => Number(getComputedStyle(e).opacity)))

test('a text layer gets an entrance; bar and block drags are one undo step each', async () => {
  app = await launch(box)
  const page = await app.firstWindow()
  await openAsVideo(page)
  const name = await selectTextLayer(page)
  const barEnd = slider(page, `End of Timing of ${name}`)
  const lengthMs = await valueOf(barEnd)
  expect(lengthMs).toBeGreaterThanOrEqual(1000)

  // A preset puts a half-second entrance block at the layer's start.
  await page.getByRole('combobox', { name: 'Entrance' }).selectOption({ label: 'Fade' })
  const entranceEnd = slider(page, `End of Entrance of ${name}`)
  await expect(entranceEnd).toHaveAttribute('aria-valuenow', '500')
  await expect(slider(page, `Start of Entrance of ${name}`)).toHaveAttribute('aria-valuenow', '0')

  // The bar's end dragged to the middle, then one Undo puts it back at the variant's end.
  await dragBy(page, barEnd, -0.5)
  await expect.poll(() => valueOf(barEnd)).toBeLessThan(lengthMs * 0.6)
  expect((await valueOf(barEnd)) % 100).toBe(0)
  await undo(page)
  await expect(barEnd).toHaveAttribute('aria-valuenow', String(lengthMs))

  // The entrance block's end dragged right, then one Undo makes it half a second again.
  await dragBy(page, entranceEnd, 0.1)
  await expect.poll(() => valueOf(entranceEnd)).toBeGreaterThan(500)
  await undo(page)
  await expect(entranceEnd).toHaveAttribute('aria-valuenow', '500')
  await expect(page.getByRole('combobox', { name: 'Entrance' })).toHaveValue('fade')

  // The canvas inside the entrance draws the text part-faded; after it, in full.
  const faded = async () => (await opacities(page)).findIndex((o) => o > 0 && o < 1)
  await scrubTo(page, 250 / lengthMs)
  await expect.poll(faded).toBeGreaterThanOrEqual(0)
  const index = await faded()
  await scrubTo(page, 0.5)
  await expect.poll(async () => (await opacities(page))[index]).toBe(1)
})
