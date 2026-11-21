// P3-12: the layer list's actions. The campaign comes from the S2-16 brief; a soft sky picture,
// drawn in the sandbox, fills the background. Then, by the list's own buttons: a text layer and
// a picture layer added (the row actions show on the selected row), one layer hidden and one
// locked, and a row being renamed.
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

async function backgroundPicture(session: Session): Promise<void> {
  const { app, page, box } = session
  const state = await query(page, 'app.getState', {})
  const projectId = (state.openProjects as { projectId: string }[])[0]!.projectId
  const project = await query(page, 'project.get', { projectId })
  const campaignId = (project.campaigns as { id: string }[])[0]!.id
  const campaign = await query(page, 'campaign.get', { projectId, campaignId })
  const variantId = (campaign.variants as { id: string }[])[0]!.id
  const variant = await query(page, 'variant.get', { projectId, variantId })
  const layers = variant.layers as { id: string; type: string }[]
  const sky = path.join(box.root, 'alpine-sky.png')
  await skyPicture(app, sky)
  const { assetIds } = await command(page, 'asset.import', {
    projectId,
    paths: [sky],
    library: 'asset',
    copy: false,
  })
  await command(page, 'layer.update', {
    projectId,
    layerId: layers.find((l) => l.type === 'background')!.id,
    patch: { source: { assetId: (assetIds as string[])[0] } },
  })
}

test('The layer list actions', async () => {
  session = await openApp()
  const { app, page } = session
  await screens.createProject(page, 'Alpine Spring')
  await screens.answerOpenDialog(app, [BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  await page
    .getByRole('region', { name: 'Brief' })
    .getByRole('button', { name: 'Create campaign' })
    .click()
  await expect(page.getByRole('list', { name: 'Variants' }).getByRole('button')).toHaveCount(1)
  await backgroundPicture(session)
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().click()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()

  const list = page.getByRole('list', { name: 'Layers' })
  await page.getByRole('button', { name: 'Add picture layer' }).click()
  await expect(list.getByRole('button', { name: /^Picture 1/ })).toBeVisible()
  await page.getByRole('button', { name: 'Add text layer' }).click()
  await expect(list.getByRole('button', { name: 'Delete Text 3' })).toBeVisible()
  await page.mouse.move(640, 790)
  await page.waitForTimeout(500)
  await shot(page, '50-layer-list-actions')

  await list.getByRole('button', { name: /^Picture 1/ }).click()
  await list.getByRole('button', { name: 'Hide Picture 1' }).click()
  const headline = list.getByRole('button', { name: /^Headline/ })
  await headline.click()
  await list.getByRole('button', { name: /^Lock Headline/ }).click()
  await list.getByRole('button', { name: /^Text 3/ }).click()
  await expect(list.getByRole('button', { name: 'Show Picture 1' })).toBeVisible()
  await expect(list.getByRole('button', { name: /^Unlock Headline/ })).toBeVisible()
  await page.mouse.move(640, 790)
  await page.waitForTimeout(300)
  await shot(page, '51-layer-list-hidden-locked')

  await list.getByText('Text 3', { exact: true }).dblclick()
  const field = page.getByRole('textbox', { name: 'Layer name' })
  await field.fill('Summer offer: two bottles for the price of one')
  await shot(page, '52-layer-list-renaming')
  await field.press('Enter')
  await expect(list.getByRole('button', { name: /^Summer offer/ })).toBeVisible()
})
