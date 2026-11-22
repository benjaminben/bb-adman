// P5-16: the fan-out dialog. One campaign at three sizes (1080 × 1080, 1080 × 1920 and
// 1920 × 1080) in two languages, its master given a soft gradient as the background picture.
// 156 the dialog as opened; 157 two new sizes ticked with their fit groups; 158 one size set to
// "Generate fill" with the fake provider chosen and the paid line shown; then "Make variants":
// 159 the grid after the fan-out, 161 the fill placed. 160 (the fill running) is not made: the
// fake fill ends before the page shows "Running", and its wait cannot be set in the built app.
// The fake provider only; nothing is paid and no request leaves the computer. Made-up names only.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { command, makePng, query } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

const CAMPAIGN = 'Ridge Trail Water'
const TALL = '1080x1920 (1080×1920)'
const WIDE = '1920x1080 (1920×1080)'

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

async function setUp(app: ElectronApplication, page: Page, root: string) {
  await screens.createProject(page, 'Ridge Trail')
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
  const { variantId } = (await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: CAMPAIGN,
      region: 'US',
      audience: 'Trail runners',
      message: 'Cold water for the long climb',
      callToAction: 'Find it near you',
      subjects: [{ name: 'Bottle' }],
    },
    subjectMap: [{ subjectId: 'bottle', create: true }],
    languages: ['en', 'de'],
    sizes: [
      { label: '1080x1080', width: 1080, height: 1080 },
      { label: '1080x1920', width: 1080, height: 1920 },
      { label: '1920x1080', width: 1920, height: 1080 },
    ],
    templateId: 'starter',
  })) as { variantId: string }
  const read = (await query(page, 'variant.get', { projectId, variantId })) as {
    layers: { id: string; type: string }[]
  }
  const background = read.layers.find((l) => l.type === 'background')!
  const patch = { source: { assetId: assetIds[0] } }
  await command(page, 'layer.update', { projectId, layerId: background.id, patch })
}

const fill = (dialog: ReturnType<Page['getByRole']>, size: string) =>
  dialog
    .getByRole('group', { name: `Background for ${size}` })
    .getByRole('radio', { name: 'Generate fill: extend the picture with AI' })

test('Fan-out: the dialog, the fits, the paid line, and a fill run with the fake', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { app, page, box } = session
  await setUp(app, page, box.root)
  await page.getByRole('button', { name: `Open ${CAMPAIGN}` }).click()
  await expect(page.getByRole('heading', { name: CAMPAIGN, level: 2 })).toBeVisible()

  await page.getByRole('button', { name: 'Fan out…' }).click()
  const dialog = page.getByRole('dialog', { name: /^Fan out / })
  await expect(dialog.getByText('Nothing new to make.')).toBeVisible()
  await shot(page, '156-fan-out-dialog')

  await dialog.getByRole('checkbox', { name: TALL }).check()
  await dialog.getByRole('checkbox', { name: WIDE }).check()
  await expect(dialog.getByRole('group', { name: `Background for ${WIDE}` })).toBeVisible()
  await expect(dialog.getByText('This makes 2 variant(s).')).toBeVisible()
  await shot(page, '157-fan-out-fits')

  await fill(dialog, TALL).check()
  await dialog.getByLabel('Provider').selectOption({ label: 'Fake provider' })
  await expect(dialog.getByText('This will use 1 generation(s) with Fake provider.')).toBeVisible()
  await shot(page, '158-fan-out-fill-paid-line')

  const grid = page.getByRole('list', { name: /^Variants in / })
  await dialog.getByRole('button', { name: 'Make variants' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(grid.getByRole('listitem')).toHaveCount(3)
  await shot(page, '159-grid-after-fan-out')
  const tall = grid.getByRole('listitem').filter({ hasText: '1080×1920' })
  await expect(tall.getByText('New result')).toBeVisible({ timeout: 60_000 })
  await shot(page, '161-fill-placed')
})
