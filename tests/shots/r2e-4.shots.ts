// R2E-4: the Generate panel, pictures. The campaign comes from the S2-16 brief; a picture
// layer "Hero photo" of 3 by 2 is added with a drawn sunrise. The project also holds two more
// drawn pictures of 3 by 2 and a square one. 324 is the panel on the picture layer; 325 is
// "Another picture of the same shape…" with one of them chosen (the square one is not
// listed). Reduce motion keeps the editor still. Nothing is sent to a provider.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { answerQuit } from '../e2e/quit-answer'
import { command, makePng, query } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

const BRIEF = path.resolve('tests/shots/fixtures/s2-16-brief.yaml')

let session: Session | undefined

test.afterEach(async () => {
  if (session) await answerQuit(session.app)
  await closeApp(session)
  session = undefined
})

type Rgb = [number, number, number]
type Paint = (x: number, y: number, w: number, h: number) => Rgb

const mix = (a: Rgb, b: Rgb, t: number): Rgb =>
  [0, 1, 2].map((i) => Math.round(a[i]! + (b[i]! - a[i]!) * t)) as Rgb

// A low sun over a hill, the sky warm at the foot.
const SUNRISE: Paint = (x, y, w, h) => {
  if ((x - w * 0.6) ** 2 + (y - h * 0.55) ** 2 < (h * 0.16) ** 2) return [250, 200, 90]
  if (y > h * 0.7 - Math.sin((x / w) * Math.PI) * h * 0.12) return [70, 96, 74]
  return mix([120, 150, 210], [244, 170, 120], y / h)
}
// A still lake under a pale sky.
const LAKE: Paint = (_x, y, _w, h) =>
  y < h * 0.55
    ? mix([200, 220, 240], [236, 214, 200], y / h)
    : mix([60, 110, 150], [30, 60, 90], y / h)
// A trail map: a cream ground with a winding red line.
const MAP: Paint = (x, y, w, h) =>
  Math.abs(y - h / 2 - Math.sin((x / w) * 6) * h * 0.2) < 6 ? [200, 60, 50] : [240, 232, 210]
// A round green badge on white.
const BADGE: Paint = (x, y, w, h) =>
  (x - w / 2) ** 2 + (y - h / 2) ** 2 < (w * 0.4) ** 2 ? [60, 150, 90] : [255, 255, 255]

async function picture(app: ElectronApplication, file: string, w: number, h: number, paint: Paint) {
  const bgra: number[] = []
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const [r, g, b] = paint(x, y, w, h)
      bgra.push(b, g, r, 255)
    }
  }
  fs.writeFileSync(file, await makePng(app, { width: w, height: h, bgra }))
}

async function setUp(app: ElectronApplication, page: Page, root: string) {
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
  const files: [string, number, number, Paint][] = [
    ['sunrise-peak.png', 600, 400, SUNRISE],
    ['lake-at-dawn.png', 900, 600, LAKE],
    ['trail-map.png', 750, 500, MAP],
    ['badge.png', 400, 400, BADGE],
  ]
  const paths = files.map(([name]) => path.join(root, name))
  for (const [i, [, w, h, paint]] of files.entries()) await picture(app, paths[i]!, w, h, paint)
  const imported = (await command(page, 'asset.import', {
    projectId,
    paths,
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
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().dblclick()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
  await page.getByRole('button', { name: /^Hero photo/ }).click()
  const panel = page.getByRole('group', { name: 'Generate' })
  await expect(panel.getByText(/^(\d+|None) chosen$/)).toBeVisible()
  return panel
}

test('The Generate panel on a picture layer', async () => {
  session = await openApp()
  const { app, page, box } = session
  const panel = await setUp(app, page, box.root)
  await expect(panel.getByRole('radio', { name: "This layer's picture" })).toBeEnabled()
  await page.waitForTimeout(500)
  await shot(page, '324-generate-panel-picture-layer')
})

test('The pictures of the same shape', async () => {
  session = await openApp()
  const { app, page, box } = session
  const panel = await setUp(app, page, box.root)
  await panel.getByRole('radio', { name: 'Another picture of the same shape…' }).check()
  const list = panel.getByRole('region', { name: 'Pictures of the same shape' })
  await expect(list.getByRole('radio')).toHaveCount(2)
  await list.getByRole('radio', { name: 'lake-at-dawn.png' }).check()
  await page.waitForTimeout(500)
  await shot(page, '325-generate-panel-same-shape')
})
