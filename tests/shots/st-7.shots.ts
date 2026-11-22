// ST-7: the editor in the app style. The campaign comes from the S2-16 brief; a picture of a
// sunset, drawn in the sandbox, goes into a new square picture layer. Then: the editor with that
// layer selected (frame, top bar, layer rows with their type icons, the canvas on its warm
// ground with the ad's shadow, the canvas bar); and crop mode entered by a double-click.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { command, query } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

const BRIEF = path.resolve('tests/shots/fixtures/s2-16-brief.yaml')
const LAYER = { x: 300, y: 380, width: 480, height: 480 }

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

// An 800 by 500 sunset: sky from blue to orange, a yellow sun, a dark green hill at the foot.
async function sunset(app: ElectronApplication, folder: string): Promise<string> {
  const png = await app.evaluate(({ nativeImage }) => {
    const width = 800
    const height = 500
    const pixels = Buffer.alloc(width * height * 4)
    for (let y = 0; y < height; y += 1) {
      const t = y / height
      for (let x = 0; x < width; x += 1) {
        let rgb = [70 + 180 * t, 120 + 60 * t, 200 - 140 * t]
        if (Math.hypot(x - 280, y - 260) < 85) rgb = [255, 214, 90]
        if (y > 380 + 30 * Math.sin(x / 90)) rgb = [40, 90, 60]
        pixels.set([rgb[2]!, rgb[1]!, rgb[0]!, 255], (y * width + x) * 4)
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
  return { projectId, variantId: campaign.variants[0]!.id }
}

// Opens the editor on the brief's master with the sunset in a picture layer; returns the layer.
async function editorWithPicture(s: Session) {
  const { app, page, box } = s
  await screens.createProject(page, 'Alpine Spring')
  await screens.answerOpenDialog(app, [BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  await page
    .getByRole('region', { name: 'New campaign' })
    .getByRole('button', { name: 'Create campaign' })
    .click()
  await expect(page.getByRole('list', { name: 'Variants' }).getByRole('listitem')).toHaveCount(1)
  const { projectId, variantId } = await ids(page)
  const file = await sunset(app, box.root)
  const { assetIds } = (await command(page, 'asset.import', {
    projectId,
    paths: [file],
    library: 'asset',
    copy: false,
  })) as { assetIds: string[] }
  const { layerId } = (await command(page, 'layer.create', {
    projectId,
    variantId,
    type: 'image',
    values: {
      name: 'Sunset photo',
      source: { assetId: assetIds[0] },
      style: { opacity: 1 },
      geometry: { ...LAYER, rotation: 0, crop: null },
    },
  })) as { layerId: string }
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().dblclick()
  const photo = page.locator(`[data-stage] [data-layer-id="${layerId}"]`)
  await expect(photo).toBeVisible()
  await page.waitForTimeout(600)
  return photo
}

test('The editor with a picture layer selected', async () => {
  session = await openApp()
  const photo = await editorWithPicture(session)
  const at = (await photo.boundingBox())!
  await session.page.mouse.click(at.x + at.width / 2, at.y + at.height / 2)
  await expect(session.page.getByRole('button', { name: /^Sunset photo/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await session.page.mouse.move(0, 0)
  await session.page.waitForTimeout(300)
  await shot(session.page, '190-editor-image')
})

test('The editor in crop mode', async () => {
  session = await openApp()
  const { page } = session
  const photo = await editorWithPicture(session)
  const at = (await photo.boundingBox())!
  await page.mouse.dblclick(at.x + at.width / 2, at.y + at.height / 2)
  await expect(page.getByRole('group', { name: 'Crop, Sunset photo' })).toBeFocused()
  await page.waitForTimeout(300)
  await shot(page, '191-editor-crop')
})
