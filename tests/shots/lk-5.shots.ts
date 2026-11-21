// LK-5: the Box, Shade and Background colour fields. The campaign comes from the S2-16 brief,
// with a three-colour palette and a made-up photo (a sky-to-sand gradient) on the background.
// Then: the headline with an outlined box and its Box fields (110); the background's Shade
// fields over the photo (111); the Background colour field with a colour chosen and no picture
// (112); the headline moved half past the top edge, its handles drawn over the backdrop (113).
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { command, query } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

const BRIEF = path.resolve('tests/shots/fixtures/s2-16-brief.yaml')
const PALETTE = ['#1F6FB2', '#E8F4FA', '#F2A541']

let session: Session | undefined

test.afterEach(async () => {
  try {
    await closeApp(session)
  } finally {
    session = undefined
  }
})

type Layer = { id: string; type: string; name: string; geometry: { height: number } }
type Ids = { projectId: string; variantId: string; layers: Layer[] }

// A 900 by 600 PNG: blue sky fading to pale sand, with a dark band low down.
async function makePhoto(app: ElectronApplication, file: string): Promise<void> {
  const png = await app.evaluate(({ nativeImage }) => {
    const [width, height] = [900, 600]
    const pixels = Buffer.alloc(width * height * 4)
    for (let y = 0; y < height; y += 1) {
      const t = y / height
      const band = y > 440 && y < 500
      const [r, g, b] = band
        ? [70, 60, 50]
        : [Math.round(60 + 180 * t), Math.round(140 + 85 * t), Math.round(220 - 30 * t)]
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4
        pixels[i] = b
        pixels[i + 1] = g
        pixels[i + 2] = r
        pixels[i + 3] = 255
      }
    }
    return nativeImage.createFromBitmap(pixels, { width, height }).toPNG().toString('base64')
  })
  fs.writeFileSync(file, Buffer.from(png, 'base64'))
}

async function campaignFromBrief(app: ElectronApplication, page: Page): Promise<Ids> {
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
  await command(page, 'ruleSet.update', { projectId, campaignId, palette: PALETTE })
  const campaign = (await query(page, 'campaign.get', { projectId, campaignId })) as {
    variants: { id: string }[]
  }
  const variantId = campaign.variants[0]!.id
  const got = (await query(page, 'variant.get', { projectId, variantId })) as { layers: Layer[] }
  return { projectId, variantId, layers: got.layers }
}

const panel = (page: Page) => page.getByRole('region', { name: 'Properties' })

async function select(page: Page, layer: Layer) {
  await page.getByRole('button', { name: new RegExp(`^${layer.name}`) }).click()
  await expect(panel(page).getByRole('heading', { name: layer.name })).toBeVisible()
}

test('The Box, Shade and Background colour fields', async () => {
  session = await openApp()
  const { app, page, box } = session
  const ids = await campaignFromBrief(app, page)
  const { projectId } = ids
  const background = ids.layers.find((l) => l.type === 'background')!
  const headline = ids.layers.find((l) => l.type === 'text' && l.name === 'Headline')!
  const photo = path.join(box.root, 'sky-and-sand.png')
  await makePhoto(app, photo)
  const { assetIds } = (await command(page, 'asset.import', {
    projectId,
    paths: [photo],
    library: 'asset',
    copy: false,
  })) as { assetIds: string[] }
  const update = (layerId: string, patch: object) =>
    command(page, 'layer.update', { projectId, layerId, patch })
  await update(background.id, { source: { assetId: assetIds[0] } })
  await update(headline.id, {
    style: {
      verticalAlign: 'middle',
      fontSize: 56,
      boxColor: '#1F6FB2',
      boxOutlineColor: '#F2A541',
      boxOutlineWidth: 6,
      boxRadius: 28,
      boxPadding: 16,
    },
  })

  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().click()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
  await select(page, headline)
  const boxFields = panel(page).getByRole('group', { name: 'Box' })
  await expect(boxFields.getByRole('button', { name: 'Middle' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.waitForTimeout(300)
  await shot(page, '110-text-box-fields')

  await select(page, background)
  const shade = panel(page).getByRole('group', { name: 'Shade' })
  await expect(shade.getByRole('combobox', { name: 'Shade' })).toHaveValue('bottom')
  await expect(shade.getByRole('spinbutton', { name: 'Strength' })).toHaveValue('70')
  await page.waitForTimeout(300)
  await shot(page, '111-shade-fields-over-photo')

  const picture = panel(page).getByRole('group', { name: 'Picture' })
  await picture.getByRole('button', { name: 'Remove picture' }).click()
  await picture.getByRole('button', { name: `Palette ${PALETTE[2]} for background colour` }).click()
  await expect(
    picture.getByRole('textbox', { name: 'Background colour', exact: true }),
  ).toHaveValue(PALETTE[2]!)
  await page.waitForTimeout(500)
  await shot(page, '112-background-colour')

  await update(headline.id, { geometry: { y: -Math.round(headline.geometry.height / 2) } })
  await select(page, headline)
  await page.waitForTimeout(500)
  await shot(page, '113-layer-past-the-edge')
})
