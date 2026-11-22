// R2E-5: results in the editor (spec/phases/round-2-editor.md D6). The campaign comes from the
// S2-16 brief. 326: the fake provider makes two pictures for the empty background; the first
// is put on the layer, the line says so and the run is first under "New pictures". 327: a
// picture layer "Hero photo" that holds a drawn sunrise gets a run of two; its picture stays
// and the line says to click one. Reduce motion and a fixed Math.random keep the window still.
// Only the fake provider runs; nothing leaves this machine.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { answerQuit } from '../e2e/quit-answer'
import { command, makePng, query } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

const BRIEF = path.resolve('tests/shots/fixtures/s2-16-brief.yaml')
const PLACED = 'Done. The first new picture is on the layer. Click another below to use it instead.'
const CLICK = 'Done. Click a new picture below to put it on the layer.'

let session: Session | undefined

test.afterEach(async () => {
  if (session) await answerQuit(session.app)
  await closeApp(session)
  session = undefined
})

// A 600 by 400 PNG: a low sun over a green hill, the sky warm at the foot.
async function sunrise(app: ElectronApplication, file: string): Promise<void> {
  const [w, h] = [600, 400]
  const bgra: number[] = []
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const t = y / h
      let rgb = [120 + 124 * t, 150 + 20 * t, 210 - 90 * t]
      if (y > h * 0.7 - Math.sin((x / w) * Math.PI) * h * 0.12) rgb = [70, 96, 74]
      if ((x - w * 0.6) ** 2 + (y - h * 0.55) ** 2 < (h * 0.16) ** 2) rgb = [250, 200, 90]
      bgra.push(Math.round(rgb[2]!), Math.round(rgb[1]!), Math.round(rgb[0]!), 255)
    }
  }
  fs.writeFileSync(file, await makePng(app, { width: w, height: h, bgra }))
}

// The project, its campaign and the variant's ID, with the window held still.
async function setUp(app: ElectronApplication, page: Page) {
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
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
  const got = (await query(page, 'variant.get', { projectId, variantId })) as {
    layers: { type: string; name: string }[]
  }
  const background = got.layers.find((l) => l.type === 'background')!.name
  return { projectId, variantId, background }
}

async function openLayer(page: Page, name: string) {
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().dblclick()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click()
  const panel = page.getByRole('group', { name: 'Generate' })
  await expect(panel.getByText(/^(\d+|None) chosen$/)).toBeVisible()
  return panel
}

// Two pictures from the fake provider, until the line gives `words`.
async function makeTwo(page: Page, words: string) {
  const panel = page.getByRole('group', { name: 'Generate' })
  await panel.getByRole('button', { name: 'Generate…' }).click()
  const run = page.getByRole('dialog', { name: 'Make pictures' })
  await run.getByRole('radio', { name: 'Fake provider' }).check()
  await run.getByRole('spinbutton', { name: 'Pictures' }).fill('2')
  await run.getByRole('button', { name: 'Generate' }).click()
  await expect(run).toBeHidden()
  await expect(panel.getByText(words)).toBeVisible({ timeout: 20_000 })
  const fresh = panel.getByRole('region', { name: 'New pictures' })
  await expect(fresh.getByRole('button', { name: /^Use option/ })).toHaveCount(2)
  await panel.getByText(words).scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  return fresh
}

test('A run on an empty layer puts its first picture there', async () => {
  session = await openApp()
  const { app, page } = session
  const { background } = await setUp(app, page)
  await openLayer(page, background)
  const fresh = await makeTwo(page, PLACED)
  await expect(fresh.getByText('In use')).toBeVisible()
  await shot(page, '326-run-done-picture-placed')
})

test('A run on a layer that had a picture leaves it', async () => {
  session = await openApp()
  const { app, page, box } = session
  const { projectId, variantId } = await setUp(app, page)
  const file = path.join(box.root, 'sunrise-peak.png')
  await sunrise(app, file)
  const imported = (await command(page, 'asset.import', {
    projectId,
    paths: [file],
    library: 'asset',
    copy: false,
  })) as { assetIds: string[] }
  await command(page, 'layer.create', {
    projectId,
    variantId,
    type: 'image',
    values: {
      name: 'Hero photo',
      source: { assetId: imported.assetIds[0] },
      geometry: { x: 300, y: 420, width: 480, height: 320, rotation: 0, crop: null },
    },
  })
  await openLayer(page, 'Hero photo')
  const fresh = await makeTwo(page, CLICK)
  await expect(fresh.getByText('In use')).toHaveCount(0)
  await shot(page, '327-run-done-layer-had-picture')
})
