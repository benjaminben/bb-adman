// P3-15: crop mode. The campaign comes from the S2-16 brief. A wide sunset picture, drawn in
// the sandbox, goes into a new square picture layer. Then: crop mode just entered by a
// double-click (the whole picture, dimmed outside the crop, eight handles); the crop made
// smaller and moved; the layer after "Done", with "Reset crop" in the panel.
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

// A 1600 by 1000 sunset: sky fading from blue to orange, a yellow sun left of the middle and
// a dark green hill along the foot, so the cropped part is easy to tell.
async function sunset(app: ElectronApplication, folder: string): Promise<string> {
  const png = await app.evaluate(({ nativeImage }) => {
    const width = 1600
    const height = 1000
    const pixels = Buffer.alloc(width * height * 4)
    for (let y = 0; y < height; y += 1) {
      const t = y / height
      for (let x = 0; x < width; x += 1) {
        let rgb = [70 + 180 * t, 120 + 60 * t, 200 - 140 * t]
        if (Math.hypot(x - 560, y - 520) < 170) rgb = [255, 214, 90]
        if (y > 760 + 60 * Math.sin(x / 180)) rgb = [40, 90, 60]
        const i = (y * width + x) * 4
        pixels.set([rgb[2]!, rgb[1]!, rgb[0]!, 255], i)
      }
    }
    return nativeImage.createFromBitmap(pixels, { width, height }).toPNG().toString('base64')
  })
  const file = path.join(folder, 'evening-sunset.png')
  fs.writeFileSync(file, Buffer.from(png, 'base64'))
  return file
}

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
  return { projectId, variant: campaign.variants[0]! }
}

const panel = (page: Page) => page.getByRole('region', { name: 'Properties' })
const LAYER = { x: 300, y: 380, width: 480, height: 480 }

test('Crop mode', async () => {
  session = await openApp()
  const { app, page, box } = session
  await screens.createProject(page, 'Alpine Spring')
  await screens.answerOpenDialog(app, [BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  await page
    .getByRole('region', { name: 'Brief' })
    .getByRole('button', { name: 'Create campaign' })
    .click()
  await expect(page.getByRole('list', { name: 'Variants' }).getByRole('listitem')).toHaveCount(1)
  const { projectId, variant } = await ids(page)

  const file = await sunset(app, box.root)
  const { assetIds } = (await command(page, 'asset.import', {
    projectId,
    paths: [file],
    library: 'asset',
    copy: false,
  })) as { assetIds: string[] }
  const { layerId } = (await command(page, 'layer.create', {
    projectId,
    variantId: variant.id,
    type: 'image',
    values: {
      name: 'Sunset photo',
      source: { assetId: assetIds[0] },
      style: { opacity: 1 },
      geometry: { ...LAYER, rotation: 0, crop: null },
    },
  })) as { layerId: string }

  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().click()
  const photo = page.locator(`[data-stage] [data-layer-id="${layerId}"]`)
  await expect(photo).toBeVisible()
  await page.waitForTimeout(600)
  const at = (await photo.boundingBox())!
  await page.mouse.dblclick(at.x + at.width / 2, at.y + at.height / 2)
  const crop = page.getByRole('group', { name: 'Crop, Sunset photo' })
  await expect(crop).toBeFocused()
  await page.waitForTimeout(300)
  await shot(page, '67-crop-mode-entered')

  // Smaller from the top-left corner, then moved left and down onto the sun.
  const corner = (await page.locator('[data-crop-handle="nw"]').boundingBox())!
  await page.mouse.move(corner.x + 4, corner.y + 4)
  await page.mouse.down()
  await page.mouse.move(corner.x + 60, corner.y + 60, { steps: 5 })
  await page.mouse.up()
  const inside = (await crop.boundingBox())!
  await page.mouse.move(inside.x + inside.width / 2, inside.y + inside.height / 2)
  await page.mouse.down()
  await page.mouse.move(inside.x + inside.width / 2 - 70, inside.y + inside.height / 2 + 6, {
    steps: 5,
  })
  await page.mouse.up()
  await page.waitForTimeout(200)
  await shot(page, '68-crop-mode-moved-smaller')

  await page.getByRole('button', { name: 'Done' }).click()
  await expect(crop).toHaveCount(0)
  await expect(panel(page).getByRole('button', { name: 'Reset crop' })).toBeVisible()
  await page.waitForTimeout(600)
  await shot(page, '69-crop-applied')
})
