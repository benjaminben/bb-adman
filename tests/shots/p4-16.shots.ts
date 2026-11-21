// P4-16: Place text with AI. The campaign comes from the S2-16 brief, with a soft gradient as
// the background picture. The text layers are first put out of place; the fake provider then
// places them on the default layout (85 before, 86 after). The run dialog for layout (87)
// shows Gemini's one-request line. 70, owed by P4-10: a Gemini layout run is held running
// (tests/e2e/held-run.ts: no request leaves the computer, the key is made up), then closing
// the variant's tab asks first.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { holdGemini } from '../e2e/held-run'
import { MADE_UP_KEY } from '../e2e/gemini-stand-in'
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

type Layer = { id: string; type: string; name: string; copy: string | null }

// 200 by 250: a warm sand at the top fading to a soft coral at the foot.
function gradient(): number[] {
  const bgra: number[] = []
  for (let y = 0; y < 250; y += 1) {
    const t = y / 250
    for (let x = 0; x < 200; x += 1) bgra.push(170 - 60 * t, 214 - 70 * t, 240, 255)
  }
  return bgra
}

// The project, its campaign from the brief, a background picture and the variant's layers.
async function setUp(app: ElectronApplication, page: Page, root: string) {
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
    layers: Layer[]
  }
  const file = path.join(root, 'sand.png')
  fs.writeFileSync(file, await makePng(app, { width: 200, height: 250, bgra: gradient() }))
  const imported = (await command(page, 'asset.import', {
    projectId,
    paths: [file],
    library: 'asset',
    copy: false,
  })) as { assetIds: string[] }
  const background = variant.layers.find((l) => l.type === 'background')!
  const patch = { source: { assetId: imported.assetIds[0] } }
  await command(page, 'layer.update', { projectId, layerId: background.id, patch })
  return { projectId, layers: variant.layers }
}

// Each text layer with copy, out of place: tilted boxes down the left side. The headline is
// cut short, so it fits the box the default layout gives it.
async function scatter(page: Page, projectId: string, layers: Layer[]) {
  const texts = layers.filter((l) => l.type === 'text' && (l.copy ?? '').trim() !== '')
  for (const [i, layer] of texts.entries()) {
    const geometry = { x: 40 + i * 30, y: 380 + i * 300, width: 560, height: 220, rotation: 8 }
    const copy = layer.name === 'Headline' ? { copy: 'Straight from the mountain' } : {}
    const patch = { geometry, ...copy }
    await command(page, 'layer.update', { projectId, layerId: layer.id, patch })
  }
}

// How many text layers are still tilted: the layout sets every rotation to 0.
async function tilted(page: Page, projectId: string, layers: Layer[]): Promise<number> {
  const variantId = (layers[0] as Layer & { variantId: string }).variantId
  const read = (await query(page, 'variant.get', { projectId, variantId })) as {
    layers: (Layer & { geometry: { rotation: number } })[]
  }
  return read.layers.filter((l) => l.type === 'text' && l.geometry.rotation !== 0).length
}

async function openVariant(page: Page) {
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().click()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
}

const placeDialog = (page: Page) => page.getByRole('dialog', { name: 'Place text with AI' })

test('Place text with AI, before and after', async () => {
  session = await openApp()
  const { app, page, box } = session
  const { projectId, layers } = await setUp(app, page, box.root)
  await scatter(page, projectId, layers)
  await openVariant(page)
  await page.waitForTimeout(500)
  await shot(page, '85-place-text-before')

  await page.getByRole('button', { name: 'Place text with AI…' }).click()
  const dialog = placeDialog(page)
  await dialog.getByRole('radio', { name: 'Google Gemini' }).check()
  await expect(dialog).toContainText('This sends 1 paid request to Google Gemini.')
  await page.waitForTimeout(300)
  await shot(page, '87-place-text-run-dialog')

  await dialog.getByRole('radio', { name: 'Fake provider' }).check()
  await dialog.getByRole('button', { name: 'Place text' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('Placing text with AI…')).toHaveCount(0, { timeout: 15_000 })
  await expect.poll(() => tilted(page, projectId, layers)).toBe(0)
  await page.waitForTimeout(500)
  await shot(page, '86-place-text-after')
})

test('Closing a variant tab while its text is being placed', async () => {
  session = await openApp()
  const { app, page, box } = session
  await holdGemini(app)
  await setUp(app, page, box.root)
  await command(page, 'secret.set', { name: 'gemini.apiKey', value: MADE_UP_KEY })
  await openVariant(page)

  await page.getByRole('button', { name: 'Place text with AI…' }).click()
  const dialog = placeDialog(page)
  await dialog.getByRole('radio', { name: 'Google Gemini' }).check()
  await dialog.getByRole('button', { name: 'Place text' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('Placing text with AI…')).toBeVisible()

  await page.getByRole('button', { name: 'Close tab' }).click()
  const warning = page.getByRole('dialog', { name: 'Stop placing text with AI?' })
  await expect(warning).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '70-close-warning-tab')

  await warning.getByRole('button', { name: 'Stop and close' }).click()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toHaveCount(0)
})
