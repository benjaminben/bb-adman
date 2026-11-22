// P7-19: the layer tracks of a video ad. 225: each layer's timing bar. 226: a text layer with
// an entrance and an exit block, its bar shortened. 227: the Animation fields in the panel.
// 228: a bar drag in hand. Made-up names and the brief's made-up photos only.
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import { timeline } from '../e2e/timeline-seed'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  try {
    await closeApp(session)
  } finally {
    session = undefined
  }
})

const tracks = (page: Page) => timeline(page).getByRole('list', { name: 'Layer tracks' })

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

async function press(page: Page, name: string, keys: string[]) {
  await tracks(page)
    .getByRole(name.startsWith('End') ? 'slider' : 'button', { name })
    .focus()
  for (const key of keys) await page.keyboard.press(key)
}

test('the layer tracks: bars, blocks, the preset fields, a drag', async () => {
  session = await openApp()
  const { app, page } = session
  await screens.createProject(page, 'Lemon Fizz')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().dblclick()
  await page
    .getByRole('radiogroup', { name: 'Format' })
    .getByRole('radio', { name: 'Video' })
    .click()
  await expect(timeline(page)).toBeVisible()
  const name = await selectTextLayer(page)
  await shot(page, '225-layer-tracks-bars')

  await page.getByRole('combobox', { name: 'Entrance' }).selectOption({ label: 'Fade up' })
  await page.getByRole('combobox', { name: 'Exit' }).selectOption({ label: 'Fade' })
  await expect(tracks(page).getByRole('button', { name: `Exit of ${name}` })).toBeVisible()
  await press(page, `End of Timing of ${name}`, ['Shift+ArrowLeft', 'Shift+ArrowLeft'])
  await press(page, `Timing of ${name}`, ['Shift+ArrowRight'])
  const exitEnd = tracks(page).getByRole('slider', { name: `End of Exit of ${name}` })
  await expect(exitEnd).toHaveAttribute('aria-valuenow', /^\d+$/)
  await shot(page, '226-layer-tracks-blocks')

  const length = page.getByRole('spinbutton', { name: 'Entrance length' })
  await length.fill('1.5')
  await length.press('Enter')
  await expect(
    tracks(page).getByRole('slider', { name: `End of Entrance of ${name}` }),
  ).toHaveAttribute('aria-valuenow', /^\d+$/)
  await shot(page, '227-animation-fields')

  const bar = tracks(page).getByRole('button', { name: `Timing of ${name}` })
  const at = (await bar.boundingBox())!
  const y = at.y + at.height / 2
  await page.mouse.move(at.x + at.width / 2, y)
  await page.mouse.down()
  await page.mouse.move(at.x + at.width / 2 + 120, y, { steps: 6 })
  await shot(page, '228-layer-tracks-drag')
  await page.mouse.up()
})
