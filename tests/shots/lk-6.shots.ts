// LK-6: "Layout…". Two campaigns, one at 1080 × 1080 and one at 1080 × 1920, each with a soft
// gradient as the background picture. For each: the variant as made (the default layout),
// then after each of the five starter layouts, applied through the dialog. The dialog itself
// is shot once, at 1080 × 1920.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { command, makePng, query } from '../e2e/render-helpers'
import { STARTER_LAYOUTS } from '../../src/shared/config/starter-layouts'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

// 200 by 250: a dusk blue at the top fading to a warm orange at the foot.
function gradient(): number[] {
  const bgra: number[] = []
  for (let y = 0; y < 250; y += 1) {
    const t = y / 250
    for (let x = 0; x < 200; x += 1) bgra.push(150 - 110 * t, 110 + 40 * t, 60 + 180 * t, 255)
  }
  return bgra
}

const SIZES = [
  { name: 'Square', label: '1080x1080', width: 1080, height: 1080, tag: '1x1' },
  { name: 'Story', label: '1080x1920', width: 1080, height: 1920, tag: '9x16' },
]

// One campaign per size, each with the gradient as its background picture.
async function setUp(app: ElectronApplication, page: Page, root: string) {
  await screens.createProject(page, 'Layouts')
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  const projectId = state.openProjects[0]!.projectId
  const file = path.join(root, 'dusk.png')
  fs.writeFileSync(file, await makePng(app, { width: 200, height: 250, bgra: gradient() }))
  const { assetIds } = (await command(page, 'asset.import', {
    projectId,
    paths: [file],
    library: 'asset',
    copy: false,
  })) as { assetIds: string[] }
  for (const size of SIZES) {
    const { variantId } = await command(page, 'campaign.create', {
      projectId,
      brief: {
        campaignName: size.name,
        region: 'US',
        audience: 'Hikers',
        message: 'Water straight from the mountain',
        callToAction: 'Find it near you',
        subjects: [{ name: 'Bottle' }],
      },
      subjectMap: [{ subjectId: 'bottle', create: size === SIZES[0] }],
      languages: ['en'],
      sizes: [{ label: size.label, width: size.width, height: size.height }],
      templateId: 'starter',
    })
    const read = (await query(page, 'variant.get', { projectId, variantId })) as {
      layers: { id: string; type: string }[]
    }
    const background = read.layers.find((l) => l.type === 'background')!
    const patch = { source: { assetId: assetIds[0] } }
    await command(page, 'layer.update', { projectId, layerId: background.id, patch })
  }
}

async function openVariant(page: Page, campaign: string) {
  await page.getByRole('button', { name: `Open ${campaign}` }).click()
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().dblclick()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
}

const layoutDialog = (page: Page) => page.getByRole('dialog', { name: 'Choose a layout' })

test('Layout…: the dialog, and each layout at two sizes', async () => {
  session = await openApp()
  const { app, page, box } = session
  await setUp(app, page, box.root)
  let n = 104
  for (const size of SIZES) {
    const back = page.getByRole('button', { name: 'Back to project' })
    if (await back.isVisible()) await back.click()
    await openVariant(page, size.name)
    await page.waitForTimeout(500)
    await shot(page, `${n++}-layout-${size.tag}-before`)
    for (const layout of STARTER_LAYOUTS) {
      await page.getByRole('button', { name: 'Layout…' }).click()
      const dialog = layoutDialog(page)
      await dialog.getByRole('radio', { name: layout.name }).check()
      if (size.tag === '9x16' && layout === STARTER_LAYOUTS[1]) {
        await page.waitForTimeout(500)
        await shot(page, '103-layout-dialog')
      }
      await dialog.getByRole('button', { name: 'Apply' }).click()
      await expect(dialog).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled()
      await page.waitForTimeout(500)
      await shot(page, `${n++}-layout-${size.tag}-${layout.id}`)
    }
    await page.getByRole('button', { name: 'Close tab' }).click()
  }
})
