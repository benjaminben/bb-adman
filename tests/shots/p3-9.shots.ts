// P3-9: the editor frame. The campaign comes from the S2-16 brief; a soft sky gradient, drawn in
// the sandbox, is imported as the background picture so the canvas shows a real picture. Then:
// the editor open, a layer selected, and a headline too long for its box (the overflow banner).
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { command } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

const BRIEF = path.resolve('tests/shots/fixtures/s2-16-brief.yaml')
const LONG_HEADLINE =
  'Taste the mountain in every glass: cold, clear spring water from high in the Alps, ' +
  'bottled at the source and carried down to your local store every single morning'

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

test('The editor frame', async () => {
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
  const assetId = (assetIds as string[])[0]
  await command(page, 'layer.update', {
    projectId,
    layerId: background.id,
    patch: { source: { assetId } },
  })

  const headline = layers.find((l) => l.type === 'text' && l.name === 'Headline')!
  const short = { copy: 'Taste the mountain' }
  await command(page, 'layer.update', { projectId, layerId: headline.id, patch: short })
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().dblclick()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
  await page.waitForTimeout(500)
  await shot(page, '01-editor-open')

  await page.getByRole('button', { name: new RegExp(`^${headline.name}`) }).click()
  await shot(page, '02-editor-layer-selected')

  await command(page, 'layer.update', {
    projectId,
    layerId: headline.id,
    patch: { copy: LONG_HEADLINE },
  })
  // The app shell also keeps an empty role="status" line for agent activity, so the notice is
  // picked by its words.
  await expect(page.getByRole('status').filter({ hasText: /not fit/ })).toBeVisible({
    timeout: 10_000,
  })
  await page.waitForTimeout(300)
  await shot(page, '03-editor-overflow')
})
