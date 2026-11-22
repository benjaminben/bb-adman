// R2E-3: type styles when the project has no font of its own. A made-up campaign with no fonts:
// the headline's Text settings shows "Built-in styles" with "Black capitals" chosen (322), and
// "Place text with AI" on the fake provider gives the headline Bold and the rest Regular (323).
// Reduce motion and a fixed Math.random keep the screens still. Nothing is paid.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { answerQuit } from '../e2e/quit-answer'
import { command, makePng, query } from '../e2e/render-helpers'
import { panel, select } from './lk-7-steps'
import { closeApp, openApp, shot, type Session } from './shot'

const WIDTH = 200
const HEIGHT = 250

let session: Session | undefined

test.afterEach(async () => {
  if (session) await answerQuit(session.app)
  await closeApp(session)
  session = undefined
})

// A dusk sky: deep teal at the top to a warm amber at the foot.
function dusk(): number[] {
  const out: number[] = []
  for (let y = 0; y < HEIGHT; y += 1) {
    const t = y / HEIGHT
    const r = Math.round(20 + t * 200)
    const g = Math.round(70 + t * 80)
    const b = Math.round(90 - t * 50)
    for (let x = 0; x < WIDTH; x += 1) out.push(b, g, r, 255)
  }
  return out
}

async function setUp(app: ElectronApplication, page: Page, root: string) {
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await screens.createProject(page, 'Lantern Night Market')
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  const projectId = state.openProjects[0]!.projectId
  const { campaignId } = (await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: 'Night market',
      region: 'US',
      audience: 'Neighbours out for the evening',
      message: 'Street food under the lanterns',
      callToAction: 'Every Friday from 6 pm',
      subjects: [{ name: 'Product' }],
    },
    subjectMap: [{ subjectId: 'product', create: true }],
    languages: ['en'],
    sizes: [{ label: '1080x1350', width: 1080, height: 1350 }],
    templateId: 'starter',
  })) as { campaignId: string }
  const campaign = (await query(page, 'campaign.get', { projectId, campaignId })) as {
    variants: { id: string }[]
  }
  const variantId = campaign.variants[0]!.id
  const variant = (await query(page, 'variant.get', { projectId, variantId })) as {
    layers: { id: string; type: string }[]
  }
  const file = path.join(root, 'dusk.png')
  fs.writeFileSync(file, await makePng(app, { width: WIDTH, height: HEIGHT, bgra: dusk() }))
  const imported = (await command(page, 'asset.import', {
    projectId,
    paths: [file],
    library: 'asset',
    copy: false,
  })) as { assetIds: string[] }
  const background = variant.layers.find((l) => l.type === 'background')!
  const patch = { source: { assetId: imported.assetIds[0] } }
  await command(page, 'layer.update', { projectId, layerId: background.id, patch })
  await page.getByRole('button', { name: 'Open Night market' }).click()
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().dblclick()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
}

test('Built-in styles in Text settings', async () => {
  session = await openApp()
  const { app, page, box } = session
  await setUp(app, page, box.root)
  await select(page, 'Headline')
  const group = panel(page).getByRole('group', { name: 'Built-in styles' })
  await expect(group).toBeVisible()
  await group.getByRole('button', { name: 'Black capitals' }).click()
  await expect(group.getByRole('button', { name: 'Black capitals' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await group.scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await shot(page, '322-text-settings-built-in-styles')
})

test('An ad placed with type styles', async () => {
  session = await openApp()
  const { app, page, box } = session
  await setUp(app, page, box.root)
  // Light first, so Bold pressed afterwards shows the placement's style arrived.
  await select(page, 'Headline')
  const group = panel(page).getByRole('group', { name: 'Built-in styles' })
  await group.getByRole('button', { name: 'Light' }).click()
  await expect(group.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Place text with AI…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Place text with AI' })
  await dialog.getByRole('radio', { name: 'Fake provider' }).check()
  await dialog.getByRole('button', { name: 'Place text' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(group.getByRole('button', { name: 'Bold' })).toHaveAttribute(
    'aria-pressed',
    'true',
    { timeout: 15_000 },
  )
  const dismiss = page.getByRole('button', { name: 'Dismiss' })
  if (await dismiss.isVisible()) await dismiss.click()
  await page.waitForTimeout(500)
  await shot(page, '323-place-text-type-styles')
})
