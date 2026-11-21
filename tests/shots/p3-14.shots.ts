// P3-14: the Picture section and the picture chooser. The campaign comes from the S2-16 brief.
// First the chooser with an empty asset library; then four gradient pictures, drawn in the
// sandbox, are imported (one then deleted from disk, so it is missing), the background gets the
// sky, and two picture layers are added: one with the bottle, one empty. Then: the Picture
// section for each, the background's, and the chooser with its pictures.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { command, query } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

const BRIEF = path.resolve('tests/shots/fixtures/s2-16-brief.yaml')

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

type Rgb = [number, number, number]
type Picture = { file: string; width: number; height: number; top: Rgb; foot: Rgb }

// A PNG fading from one colour at the top to another at the foot.
async function gradient(app: ElectronApplication, folder: string, p: Picture): Promise<string> {
  const png = await app.evaluate(({ nativeImage }, { width, height, top, foot }) => {
    const pixels = Buffer.alloc(width * height * 4)
    for (let y = 0; y < height; y += 1) {
      const t = y / height
      const [r, g, b] = top.map((c, i) => c + (foot[i]! - c) * t)
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4
        pixels.set([b!, g!, r!, 255], i)
      }
    }
    return nativeImage.createFromBitmap(pixels, { width, height }).toPNG().toString('base64')
  }, p)
  const file = path.join(folder, p.file)
  fs.writeFileSync(file, Buffer.from(png, 'base64'))
  return file
}

const PICTURES: Picture[] = [
  { file: 'alpine-sky.png', width: 1600, height: 1200, top: [96, 160, 230], foot: [216, 236, 220] },
  {
    file: 'spring-bottle.png',
    width: 600,
    height: 900,
    top: [30, 110, 180],
    foot: [200, 230, 245],
  },
  { file: 'meadow-wide.png', width: 1200, height: 500, top: [120, 190, 90], foot: [240, 220, 120] },
  {
    file: 'old-summer-banner.png',
    width: 800,
    height: 800,
    top: [240, 160, 60],
    foot: [250, 230, 200],
  },
]

type Layer = { id: string; type: string; name: string }

async function ids(page: Page) {
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
    layers: Layer[]
  }
  return { projectId, variantId, layers: variant.layers }
}

const panel = (page: Page) => page.getByRole('region', { name: 'Properties' })
const pictureSection = (page: Page) => panel(page).getByRole('group', { name: 'Picture' })

async function select(page: Page, name: string) {
  await page
    .getByRole('button', { name: new RegExp(`^${name}`) })
    .first()
    .click()
  await expect(panel(page).getByRole('heading', { name })).toBeVisible()
  await page.waitForTimeout(400)
}

test('Picture properties and the picture chooser', async () => {
  session = await openApp()
  const { app, page, box } = session
  await screens.createProject(page, 'Alpine Spring')
  await screens.answerOpenDialog(app, [BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  await page
    .getByRole('region', { name: 'Brief' })
    .getByRole('button', { name: 'Create campaign' })
    .click()
  await expect(page.getByRole('list', { name: 'Variants' }).getByRole('button')).toHaveCount(1)
  const { projectId, variantId, layers } = await ids(page)
  const background = layers.find((l) => l.type === 'background')!

  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().click()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
  await select(page, background.name)
  await pictureSection(page).getByRole('button', { name: 'Choose picture…' }).click()
  const chooser = page.getByRole('dialog', { name: /^Choose a picture for / })
  await expect(chooser.getByText('No pictures in the asset library yet.')).toBeVisible()
  await shot(page, '64-picture-chooser-empty')
  await chooser.getByRole('button', { name: 'Cancel' }).click()

  const files = []
  for (const p of PICTURES) files.push(await gradient(app, box.root, p))
  const { assetIds } = (await command(page, 'asset.import', {
    projectId,
    paths: files,
    library: 'asset',
    copy: false,
  })) as { assetIds: string[] }
  fs.rmSync(files[3]!)
  const [sky, bottle] = assetIds
  const update = (layerId: string, patch: unknown) =>
    command(page, 'layer.update', { projectId, layerId, patch })
  await update(background.id, { source: { assetId: sky } })
  const values = (name: string, assetId: string | null, x: number) => ({
    name,
    source: assetId ? { assetId } : null,
    style: { opacity: assetId ? 0.85 : 1 },
    geometry: { x, y: 140, width: 400, height: 560, rotation: 0, crop: null },
  })
  for (const [name, assetId, x] of [
    ['Bottle shot', bottle!, 90],
    ['Seasonal logo', null, 590],
  ] as const) {
    await command(page, 'layer.create', {
      projectId,
      variantId,
      type: 'image',
      values: values(name, assetId, x),
    })
  }

  await select(page, 'Bottle shot')
  await expect(pictureSection(page).getByText('spring-bottle.png')).toBeVisible()
  await shot(page, '60-picture-fields-picture')

  await select(page, 'Seasonal logo')
  await expect(pictureSection(page).getByText('Empty picture')).toBeVisible()
  await shot(page, '61-picture-fields-empty')

  await select(page, background.name)
  await expect(pictureSection(page).getByRole('button', { name: 'Fit inside' })).toBeEnabled()
  await shot(page, '62-picture-fields-background')

  await pictureSection(page).getByRole('button', { name: 'Choose picture…' }).click()
  await expect(chooser.getByRole('button', { name: /file not found/ })).toBeDisabled()
  await page.waitForTimeout(400)
  await shot(page, '63-picture-chooser')
})
