// ED-1a (spec/phases/design-wave-screens-a.md): the layers panel on the shared ObjectRow, with
// a hidden picture layer (Empty mark), a locked headline, a text layer whose copy does not fit,
// and the background with its picture and its "Stays at the bottom" mark. 446: the rows alone;
// 422: the More menu open on the selected text layer. The campaign comes from the S2-16 brief;
// the sky is drawn here.
import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import * as screens from '../e2e/screens'
import { command, makePng } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

const BRIEF = path.resolve('tests/shots/fixtures/s2-16-brief.yaml')
const LONG_COPY =
  'Fresh mountain water, bottled at the spring and sent down the valley the same morning'

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

async function firstVariant(page: Page): Promise<{ projectId: string; layers: Layer[] }> {
  const state = await query(page, 'app.getState', {})
  const projectId = (state.openProjects as { projectId: string }[])[0]!.projectId
  const project = await query(page, 'project.get', { projectId })
  const campaignId = (project.campaigns as { id: string }[])[0]!.id
  const campaign = await query(page, 'campaign.get', { projectId, campaignId })
  const variantId = (campaign.variants as { id: string }[])[0]!.id
  const variant = await query(page, 'variant.get', { projectId, variantId })
  return { projectId, layers: variant.layers as Layer[] }
}

// A small sky: blue at the top fading to a pale mint at the foot.
function sky(): number[] {
  const bgra: number[] = []
  for (let y = 0; y < 64; y += 1) {
    const t = y / 64
    for (let x = 0; x < 64; x += 1) bgra.push(230 - 20 * t, 160 + 70 * t, 96 + 120 * t, 255)
  }
  return bgra
}

async function backgroundPicture(session: Session): Promise<void> {
  const { app, page, box } = session
  const { projectId, layers } = await firstVariant(page)
  const file = path.join(box.root, 'alpine-sky.png')
  fs.writeFileSync(file, await makePng(app, { width: 64, height: 64, bgra: sky() }))
  const imported = await command(page, 'asset.import', {
    projectId,
    paths: [file],
    library: 'asset',
    copy: false,
  })
  await command(page, 'layer.update', {
    projectId,
    layerId: layers.find((l) => l.type === 'background')!.id,
    patch: { source: { assetId: (imported.assetIds as string[])[0] } },
  })
}

test('The layers panel with marks, state buttons and the More menu', async () => {
  session = await openApp()
  const { app, page } = session
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await screens.createProject(page, 'Alpine Spring')
  await screens.answerOpenDialog(app, [BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  await page
    .getByRole('region', { name: 'New campaign' })
    .getByRole('button', { name: 'Create campaign' })
    .click()
  await expect(page.getByRole('list', { name: 'Variants' }).getByRole('listitem')).toHaveCount(1)
  await backgroundPicture(session)
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().dblclick()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()

  const list = page.getByRole('list', { name: 'Layers' })
  await page.getByRole('button', { name: 'Add picture layer' }).click()
  await list.getByRole('button', { name: 'Hide Picture 1' }).click()
  await list.getByRole('button', { name: /^Lock Headline/ }).click()
  await page.getByRole('button', { name: 'Add text layer' }).click()
  const { projectId, layers } = await firstVariant(page)
  const text = layers.find((l) => l.name === 'Text 3')!
  await command(page, 'layer.update', {
    projectId,
    layerId: text.id,
    patch: { copy: LONG_COPY },
  })
  await expect(list.getByRole('button', { name: /^Text 3 Does not fit/ })).toBeVisible()
  await expect(list.getByRole('button', { name: 'Show Picture 1' })).toBeVisible()
  await expect(list.getByRole('button', { name: 'Unlock Headline' })).toBeVisible()
  await page.mouse.move(640, 790)
  await page.waitForTimeout(300)
  await shot(page, '446-layers-panel-rows')
  await list.getByRole('button', { name: 'More actions for Text 3' }).click()
  await expect(page.getByRole('menu', { name: 'More actions for Text 3' })).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '422-layers-panel-menu')
})
