// R2E-2: readable text after "Place text with AI". The campaign comes from the S2-16 brief,
// which has no palette, so the fake provider places every text in white. Over a pale picture
// the check turns the white texts black and the banner says so (320). Over a picture of fine
// stripes no single colour reads on both its dark and light parts, so each text gets a solid
// text box behind it (321). Reduce motion keeps the editor still. Nothing is paid.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { answerQuit } from '../e2e/quit-answer'
import { command, makePng, query } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

const BRIEF = path.resolve('tests/shots/fixtures/s2-16-brief.yaml')
const WIDTH = 200
const HEIGHT = 250

let session: Session | undefined

test.afterEach(async () => {
  if (session) await answerQuit(session.app)
  await closeApp(session)
  session = undefined
})

type Paint = (x: number, y: number) => [number, number, number]

function bgra(paint: Paint): number[] {
  const out: number[] = []
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const [r, g, b] = paint(x, y)
      out.push(b, g, r, 255)
    }
  }
  return out
}

// A pale cream, a little warmer at the foot.
const PALE: Paint = (_x, y) => [252, 249 - Math.round((y / HEIGHT) * 12), 240]
// Diagonal stripes of deep navy and white, four pixels wide.
const STRIPES: Paint = (x, y) =>
  Math.floor((x + y) / 4) % 2 === 0 ? [18, 28, 64] : [255, 255, 255]

async function setUp(app: ElectronApplication, page: Page, root: string, paint: Paint) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await screens.createProject(page, 'Alpine Spring')
  await screens.answerOpenDialog(app, [BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  await page
    .getByRole('region', { name: 'Brief' })
    .getByRole('button', { name: 'Create campaign' })
    .click()
  await expect(page.getByRole('list', { name: 'Variants' }).getByRole('listitem')).toHaveCount(1)
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  const projectId = state.openProjects[0]!.projectId
  const project = (await query(page, 'project.get', { projectId })) as {
    campaigns: { id: string }[]
  }
  const campaignId = project.campaigns[0]!.id
  const campaign = (await query(page, 'campaign.get', { projectId, campaignId })) as {
    variants: { id: string }[]
  }
  const variantId = campaign.variants[0]!.id
  const variant = (await query(page, 'variant.get', { projectId, variantId })) as {
    layers: { id: string; type: string; name: string }[]
  }
  const file = path.join(root, 'ground.png')
  fs.writeFileSync(file, await makePng(app, { width: WIDTH, height: HEIGHT, bgra: bgra(paint) }))
  const imported = (await command(page, 'asset.import', {
    projectId,
    paths: [file],
    library: 'asset',
    copy: false,
  })) as { assetIds: string[] }
  const background = variant.layers.find((l) => l.type === 'background')!
  const patch = { source: { assetId: imported.assetIds[0] } }
  await command(page, 'layer.update', { projectId, layerId: background.id, patch })
  const headline = variant.layers.find((l) => l.name === 'Headline')
  if (headline) {
    const copy = { copy: 'Straight from the mountain' }
    await command(page, 'layer.update', { projectId, layerId: headline.id, patch: copy })
  }
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().dblclick()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
}

async function placeText(page: Page) {
  await page.getByRole('button', { name: 'Place text with AI…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Place text with AI' })
  await dialog.getByRole('radio', { name: 'Fake provider' }).check()
  await dialog.getByRole('button', { name: 'Place text' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText(/^Text placed\. The colours? of \d+ texts? w/)).toBeVisible({
    timeout: 15_000,
  })
}

test('The banner after the colours were changed', async () => {
  session = await openApp()
  const { app, page, box } = session
  await setUp(app, page, box.root, PALE)
  await placeText(page)
  await page.waitForTimeout(500)
  await shot(page, '320-place-text-colours-changed')
})

test('A headline with an added text box over a busy picture', async () => {
  session = await openApp()
  const { app, page, box } = session
  await setUp(app, page, box.root, STRIPES)
  await placeText(page)
  await page.getByRole('button', { name: 'Dismiss' }).click()
  await page.waitForTimeout(500)
  await shot(page, '321-place-text-added-box')
})
