// P3-11: canvas editing. The campaign comes from the S2-16 brief, with a soft sky picture as the
// background. Then: the headline selected with its handles; the headline turned and selected;
// a drag in flight held on the canvas's centre line (the snap guide); a locked layer selected
// (a box, no handles).
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { command } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

const BRIEF = path.resolve('tests/shots/fixtures/s2-16-brief.yaml')

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

type Layer = { id: string; type: string; name: string }

async function query(page: Page, name: string, input: unknown): Promise<Record<string, unknown>> {
  return page.evaluate(
    async ([n, i]) => {
      const api = (
        window as unknown as { api: { query: (n: string, i: unknown) => Promise<unknown> } }
      ).api
      return ((await api.query(n, i)) as { data: Record<string, unknown> }).data
    },
    [name, input] as const,
  )
}

// A 1600 by 1600 PNG: sky blue at the top fading to a pale mint at the foot.
async function skyPicture(app: ElectronApplication, file: string): Promise<void> {
  const png = await app.evaluate(({ nativeImage }) => {
    const size = 1600
    const pixels = Buffer.alloc(size * size * 4)
    for (let y = 0; y < size; y += 1) {
      const t = y / size
      const [r, g, b] = [96 + 120 * t, 160 + 70 * t, 230 - 20 * t]
      for (let x = 0; x < size; x += 1) {
        const i = (y * size + x) * 4
        pixels[i] = b
        pixels[i + 1] = g
        pixels[i + 2] = r
        pixels[i + 3] = 255
      }
    }
    return nativeImage
      .createFromBitmap(pixels, { width: size, height: size })
      .toPNG()
      .toString('base64')
  })
  fs.writeFileSync(file, Buffer.from(png, 'base64'))
}

async function ids(page: Page) {
  const state = await query(page, 'app.getState', {})
  const projectId = (state.openProjects as { projectId: string }[])[0]!.projectId
  const project = await query(page, 'project.get', { projectId })
  const campaignId = (project.campaigns as { id: string }[])[0]!.id
  const campaign = await query(page, 'campaign.get', { projectId, campaignId })
  const variantId = (campaign.variants as { id: string }[])[0]!.id
  const variant = await query(page, 'variant.get', { projectId, variantId })
  return { projectId, layers: variant.layers as Layer[] }
}

test('Canvas editing', async () => {
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

  const { projectId, layers } = await ids(page)
  const sky = path.join(box.root, 'alpine-sky.png')
  await skyPicture(app, sky)
  const { assetIds } = await command(page, 'asset.import', {
    projectId,
    paths: [sky],
    library: 'asset',
    copy: false,
  })
  const background = layers.find((l) => l.type === 'background')!
  const patch = { source: { assetId: (assetIds as string[])[0] } }
  await command(page, 'layer.update', { projectId, layerId: background.id, patch })
  const headline = layers.find((l) => l.type === 'text' && l.name === 'Headline')!
  const update = (layerId: string, p: unknown) =>
    command(page, 'layer.update', { projectId, layerId, patch: p })

  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().click()
  const canvas = page.getByRole('region', { name: /^Canvas, / })
  await expect(canvas).toBeVisible()
  await page.waitForTimeout(500)

  const row = (name: string) => page.getByRole('button', { name: new RegExp(`^${name}`) })
  await row(headline.name).click()
  await expect(canvas.locator('[data-handle="rotate"]')).toBeVisible()
  await shot(page, '45-canvas-text-selected')

  await update(headline.id, { geometry: { rotation: -12 } })
  await page.waitForTimeout(300)
  await shot(page, '46-canvas-turned-selected')

  await update(headline.id, { geometry: { rotation: 0 } })
  await page.waitForTimeout(300)
  // Press on the headline's middle and drag a little: its centre stays held on the canvas's
  // centre line, and the guide shows.
  const selected = await canvas.locator('[data-selection]').boundingBox()
  const x = selected!.x + selected!.width / 2
  const y = selected!.y + selected!.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 6, y + 40, { steps: 5 })
  await page.mouse.move(x + 2, y + 60, { steps: 5 })
  await expect(canvas.locator('[data-guide="x"]')).toBeVisible()
  await shot(page, '47-canvas-drag-snap-guide')
  await page.keyboard.press('Escape')
  await page.mouse.up()

  const other = layers.find((l) => l.type === 'text' && l.id !== headline.id) ?? headline
  await update(other.id, { locked: true })
  await page.waitForTimeout(300)
  await row(other.name).click()
  await expect(canvas.locator('[data-selection]')).toBeVisible()
  await expect(canvas.locator('[data-handle]')).toHaveCount(0)
  await shot(page, '48-canvas-locked-selected')
})
